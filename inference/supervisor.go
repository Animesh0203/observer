package inference

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"path/filepath"
	"syscall"
	"time"
	_ "embed"
)

func GetSharedWorkerDir() string {
    base := os.Getenv("LOCALAPPDATA")
    dir := filepath.Join(base, "ObserverAI")
    os.MkdirAll(dir, 0755)
    return dir
}

func writeMessage(stream io.Writer, message WorkerMessage) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}
	length := uint32(len(data))
	if err := binary.Write(stream, binary.BigEndian, length); err != nil {
		return err
	}
	_, err = stream.Write(data)
	return err
}

func readMessage(stream io.Reader) (WorkerMessage, error) {
	var length uint32
	if err := binary.Read(stream, binary.BigEndian, &length); err != nil {
		return WorkerMessage{}, err
	}

	data := make([]byte, length)
	if _, err := io.ReadFull(stream, data); err != nil {
		return WorkerMessage{}, err
	}

	var tmp map[string]json.RawMessage
	if err := json.Unmarshal(data, &tmp); err != nil {
		return WorkerMessage{}, err
	}

	var msg WorkerMessage
	if v, ok := tmp["id"]; ok {
		_ = json.Unmarshal(v, &msg.ID)
	}
	if v, ok := tmp["action"]; ok {
		_ = json.Unmarshal(v, &msg.Action)
	}
	if v, ok := tmp["params"]; ok {
		msg.Params = v
	}
	if v, ok := tmp["result"]; ok {
		msg.Result = v
	}
	return msg, nil
}

type Supervisor struct {
	cmd         *exec.Cmd
	stdin       io.WriteCloser
	stdout      io.ReadCloser
	pending     map[int]chan WorkerMessage
	pendingMu   sync.RWMutex
	nextID      int
	workerAlive atomic.Bool
	writeMu     sync.Mutex
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewSupervisor() *Supervisor {
	ctx, cancel := context.WithCancel(context.Background())
	return &Supervisor{
		pending: make(map[int]chan WorkerMessage),
		ctx:     ctx,
		cancel:  cancel,
	}
}

func (s *Supervisor) Start() error {
	
	select {
	case <-s.ctx.Done():
		return fmt.Errorf("supervisor cancelled")
	default:
	}

	workerDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "ObserverAI")
	workerPath := filepath.Join(workerDir, "./worker.exe")

	s.cmd = exec.Command(workerPath)
	s.cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}
	s.cmd.SysProcAttr.CreationFlags = 0x08000000

	stdin, err := s.cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := s.cmd.StdoutPipe()
	if err != nil {
		return err
	}

	s.stdin = stdin
	s.stdout = stdout
	s.cmd.Stderr = os.Stderr

	if err := s.cmd.Start(); err != nil {
		return err
	}

	s.workerAlive.Store(true)
	log.Printf("Supervisor: Worker started (PID: %d)", s.cmd.Process.Pid)

	go func() {
		if err := s.readLoop(); err != nil {
			log.Println(err)
		}
	}()
	go s.monitorCrash()

	return nil
}

func (s *Supervisor) readLoop() error {
	for {
		msg, err := readMessage(s.stdout)
		if err != nil {
			return fmt.Errorf("Supervisor read error: %w", err)
		}

		s.pendingMu.RLock()
		ch, ok := s.pending[msg.ID]
		s.pendingMu.RUnlock()
		if ok {
			ch <- msg
		}
	}
}

func (s *Supervisor) monitorCrash() {
	err := s.cmd.Wait()
	log.Printf("Supervisor: Worker exited: %v", err)

	s.workerAlive.Store(false)

	s.pendingMu.Lock()
	for id, ch := range s.pending {
		close(ch)
		delete(s.pending, id)
	}
	s.pendingMu.Unlock()

	select {
	case <-s.ctx.Done():
		return
	default:
	}

	backoff := time.Second
	for {
		log.Printf("Supervisor: Restarting in %s...", backoff)
		time.Sleep(backoff)

		select {
		case <-s.ctx.Done():
			return
		default:
		}

		if err := s.Start(); err != nil {
			log.Printf("Restart failed: %v", err)
			if backoff < 30*time.Second {
				backoff *= 2
			}
			continue
		}
		return
	}
}

func (s *Supervisor) Call(method string, params interface{}) (WorkerMessage, error) {
	if !s.workerAlive.Load() {
		return WorkerMessage{}, fmt.Errorf("worker restarting")
	}

	s.pendingMu.Lock()
	id := s.nextID
	s.nextID++
	resChan := make(chan WorkerMessage, 1)
	s.pending[id] = resChan
	s.pendingMu.Unlock()

	p, _ := json.Marshal(map[string]interface{}{"image_path": params})

	req := WorkerMessage{
		ID:     id,
		Action: method,
		Params: p,
	}

	s.writeMu.Lock()
	err := writeMessage(s.stdin, req)
	s.writeMu.Unlock()

	if err != nil {
		s.pendingMu.Lock()
		delete(s.pending, id)
		s.pendingMu.Unlock()
		return WorkerMessage{}, fmt.Errorf("write failed: %w", err)
	}

	select {
	case resp, ok := <-resChan:
		s.pendingMu.Lock()
		delete(s.pending, id)
		s.pendingMu.Unlock()

		if !ok {
			return WorkerMessage{}, fmt.Errorf("worker crashed")
		}
		return resp, nil

	case <-time.After(15 * time.Second):
		s.pendingMu.Lock()
		delete(s.pending, id)
		s.pendingMu.Unlock()
		return WorkerMessage{}, fmt.Errorf("timeout")

	case <-s.ctx.Done():
		s.pendingMu.Lock()
		delete(s.pending, id)
		s.pendingMu.Unlock()
		return WorkerMessage{}, fmt.Errorf("shutdown")
	}
}

func (s *Supervisor) Stop() {
	s.cancel()
	_, _ = s.Call("close", nil)
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Signal(os.Interrupt)
	}
}
