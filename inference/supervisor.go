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
	"time"
)

func writeMessage(stream io.Writer, message WorkerMessage) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	length := uint32(len(data))
	err = binary.Write(stream, binary.BigEndian, length)
	if err != nil {
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

	// 🔎 Print raw framed JSON we received *immediately* so we know the bytes that arrived
	log.Println("RAW FROM PYTHON (framed):", string(data))

	// Decode generically into map so we can extract RawMessage fields reliably.
	var tmp map[string]json.RawMessage
	if err := json.Unmarshal(data, &tmp); err != nil {
		log.Println("ERROR unmarshalling into tmp map:", err)
		return WorkerMessage{}, err
	}

	var msg WorkerMessage

	// Manually extract fields — preserved as bytes
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

	// 🔎 Print exactly what we will hand to callers
	log.Println("✅ readMessage FINAL RESULT BYTES:", string(msg.Result))

	return msg, nil
}

type Supervisor struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser

	pending   map[int]chan WorkerMessage
	pendingMu sync.RWMutex
	nextID    int

	writeMu sync.Mutex // PREVENT STREAM CORRUPTION

	ctx    context.Context
	cancel context.CancelFunc
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
	s.cmd = exec.Command("python", "-u", "D:\\Projects\\Machine_Learning\\observer\\observer-spot\\python\\worker.py")

	var err error
	s.stdin, err = s.cmd.StdinPipe()
	if err != nil {
		return err
	}
	s.stdout, err = s.cmd.StdoutPipe()
	if err != nil {
		return err
	}

	// go func() {
	// 	buf := make([]byte, 4096)
	// 	for {
	// 		n, err := s.stdout.Read(buf)
	// 		if n > 0 {
	// 			fmt.Println("🔥 RAW STDOUT BYTES RECEIVED:", n, "bytes:", string(buf[:n]))
	// 		}
	// 		if err != nil {
	// 			fmt.Println("🔥 RAW STDOUT READ ERROR:", err)
	// 			return
	// 		}
	// 	}
	// }()

	s.cmd.Stderr = os.Stderr

	if err := s.cmd.Start(); err != nil {
		return err
	}

	log.Printf("Supervisor: Child started (PID: %d)", s.cmd.Process.Pid)

	go func() {
		if err := s.readLoop(); err != nil {
			log.Println(err)
		}
	}()

	go s.monitorCrash()

	return nil
}

// ------------------------
// ASYNC READ LOOP
// ------------------------

func (s *Supervisor) readLoop() error {
	for {
		msg, err := readMessage(s.stdout)
		if err != nil {
			return fmt.Errorf("Supervisor: read error (most likely child crashed): %v", err)
		}

		s.pendingMu.RLock()
		ch, exists := s.pending[msg.ID]
		s.pendingMu.RUnlock()

		if exists {
			ch <- msg
		}
	}
}

// ------------------------
// CRASH MONITOR + RESTART
// ------------------------

func (s *Supervisor) monitorCrash() {
	err := s.cmd.Wait()
	log.Printf("Supervisor: Child crashed/exited: %v", err)

	// Cancel pending calls
	s.pendingMu.Lock()
	for id, ch := range s.pending {
		close(ch)
		delete(s.pending, id)
	}
	s.pendingMu.Unlock()

	select {
	case <-s.ctx.Done():
		return
	case <-time.After(1 * time.Second):
		log.Println("Supervisor: Restarting child...")
		s.Start()
	}
}

// ------------------------
// SAFE CALL WITH TIMEOUT
// ------------------------

func (s *Supervisor) Call(method string, params interface{}) (WorkerMessage, error) {
	s.pendingMu.Lock()
	id := s.nextID
	s.nextID++
	resChan := make(chan WorkerMessage, 1)
	s.pending[id] = resChan
	s.pendingMu.Unlock()

	p, _ := json.Marshal(map[string]interface{}{
		"image_path": params,
	})

	req := WorkerMessage{
		ID:     id,
		Action: method,
		Params: p,
	}

	// WRITE IS MUTEX-PROTECTED
	s.writeMu.Lock()
	err := writeMessage(s.stdin, req)
	s.writeMu.Unlock()

	if err != nil {
		s.pendingMu.Lock()
		delete(s.pending, id)
		s.pendingMu.Unlock()
		return WorkerMessage{}, fmt.Errorf("write failed: %w", err)
	}

	// TIMEOUT PROTECTION
	select {
	case response, ok := <-resChan:
		s.pendingMu.Lock()
		delete(s.pending, id)
		s.pendingMu.Unlock()

		if !ok {
			return WorkerMessage{}, fmt.Errorf("request cancelled (child crashed)")
		}
		return response, nil

	case <-time.After(10 * time.Second):
		s.pendingMu.Lock()
		delete(s.pending, id)
		s.pendingMu.Unlock()
		return WorkerMessage{}, fmt.Errorf("request timed out")
	}
}

// ------------------------
// CLEAN SHUTDOWN
// ------------------------

func (s *Supervisor) Stop() {
	// STOP AUTO-RESTART
	s.cancel()

	// PROTOCOL SHUTDOWN
	_, err := s.Call("close", nil)
	if err != nil {
		log.Printf("Supervisor: error sending close: %v", err)
	}

	// SOFT KILL BACKUP
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Signal(os.Interrupt)
	}
}
