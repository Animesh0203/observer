from function import handle_action
import sys
import json
import struct
import time

def read_exactly(stream, n):
    data = b''
    while len(data) < n:
        chunk = stream.read(n - len(data))
        if not chunk:
            raise EOFError("Stream ended unexpectedly")
        data += chunk
    return data


def read_message():
    try:
        header = read_exactly(sys.stdin.buffer, 4)
    except EOFError:
        return None

    length = struct.unpack('>I', header)[0]

    body = read_exactly(sys.stdin.buffer, length)
    return json.loads(body)


def write_message(msg):
    try:
        body = json.dumps(msg).encode("utf-8")
        length = len(body)
        header = struct.pack(">I", length)

        sys.stdout.buffer.write(header)
        sys.stdout.buffer.write(body)
        sys.stdout.buffer.flush()
    except Exception as e:
        sys.stderr.write(f"[write_message error] {e}\n")
        sys.stderr.flush()


def main():
    # Stdout vs Stderr Separation
    # Use stderr for logs. NEVER print to stdout.
    sys.stderr.write(f"Python Worker: Started (PID: {sys.argv})\n")
    sys.stderr.flush()

    while True:
        try:
            msg = read_message()
            if msg is None:
                break

            req_id = msg.get("id")
            action = msg.get("action")
            params = msg.get("params", {})
            image_path = params.get("image_path")

            sys.stderr.write(f"Python Worker: Processing ID {req_id} | Action={action}\n | ImagePath={image_path}\n")
            sys.stderr.flush()
            
            result_data = handle_action(action, image_path)

            sys.stderr.write(result_data.__str__() + "\n")
            sys.stderr.flush()
            
            response = {
                "id": req_id,
                "action": action,      
                "params": {"dummy": 1},    
                "result": result_data 
            }
            
            sys.stderr.write(response.__str__() + "\n")
            sys.stderr.flush()

            write_message(response)

            if action == "close":
                break


        except Exception as e:
            sys.stderr.write(f"Python Worker Error: {str(e)}\n")
            sys.stderr.flush()

            error_response = {
                "id": msg.get("id") if isinstance(msg, dict) else -1,
                "result": {"error": str(e)}
            }

            try:
                write_message(error_response)
            except Exception:
                break  


if __name__ == "__main__":
    write_message({"startup": True})
    main()