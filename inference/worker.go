//go:build windows
// +build windows

package inference

/*
#cgo CFLAGS: -I${SRCDIR}/../python_build/include
#cgo LDFLAGS: -L${SRCDIR}/../python_build/libs -lpython311
#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <stdlib.h>

// ---- WRAPPER FUNCTIONS ----
// Wrapping all Python C API calls to avoid type issues with CGo

static inline int pyListCheck(PyObject *obj) {
    return PyList_Check(obj);
}

static inline int pyCallableCheck(PyObject *obj) {
    return PyCallable_Check(obj);
}

static inline int pyUnicodeCheck(PyObject *obj) {
    return PyUnicode_Check(obj);
}

static inline PyObject* pyListGetItem(PyObject *list, int index) {
    return PyList_GetItem(list, (Py_ssize_t)index);
}

static inline int pyListSize(PyObject *list) {
    return (int)PyList_Size(list);
}

static inline void pyDecRef(PyObject *obj) {
    if (obj != NULL) {
        Py_DECREF(obj);
    }
}

static inline void pyIncRef(PyObject *obj) {
    if (obj != NULL) {
        Py_INCREF(obj);
    }
}

static inline const char* pyUnicodeAsUTF8(PyObject *unicode) {
    return PyUnicode_AsUTF8(unicode);
}

static inline PyObject* pyImportModule(const char *name) {
    return PyImport_ImportModule(name);
}

static inline PyObject* pyGetAttr(PyObject *obj, const char *name) {
    return PyObject_GetAttrString(obj, name);
}

static inline PyObject* pyBuildValue(const char *format, const char *value) {
    return Py_BuildValue(format, value);
}

static inline PyObject* pyCallObject(PyObject *callable, PyObject *args) {
    return PyObject_CallObject(callable, args);
}

static inline void pyErrPrint() {
    PyErr_Print();
}

static inline void pyInitialize() {
    Py_Initialize();
}

static inline void pyFinalize() {
    Py_Finalize();
}

static inline int pyRunSimpleString(const char *command) {
    return PyRun_SimpleString(command);
}

*/
import "C"

import (
	"fmt"
	"runtime"
	"sync"
	"unsafe"
)

var (
	pythonOnce sync.Once
	jobChan    chan job
)

type job struct {
	imagePath string
	unload    bool
	reply     chan jobReply
}

type jobReply struct {
	tags []string
	err  error
}

// Start the single-threaded Python worker
func ensurePythonWorker() {
	pythonOnce.Do(func() {
		jobChan = make(chan job)

		go func() {
			// CPython requires a stable single OS thread
			runtime.LockOSThread()
			defer runtime.UnlockOSThread()

			C.pyInitialize()
			defer C.pyFinalize()

			// Make sure site-packages loads
			siteCmd := C.CString("import site")
			C.pyRunSimpleString(siteCmd)
			C.free(unsafe.Pointer(siteCmd))

			// Add your Python module folder
			pathCmd := C.CString("import sys; sys.path.append('Python')")
			C.pyRunSimpleString(pathCmd)
			C.free(unsafe.Pointer(pathCmd))

			for j := range jobChan {
				if j.unload {
					success, err := unloadInternal() // calls unload_model in Python
					j.reply <- jobReply{tags: nil, err: err}
					continue
				}

				t, err := predictInternal(j.imagePath)
				j.reply <- jobReply{tags: t, err: err}
			}
		}()
	})

}

// Internal call — runs ONLY on the Python worker thread
func predictInternal(imagePath string) ([]string, error) {

	modName := C.CString("tag")
	defer C.free(unsafe.Pointer(modName))

	module := C.pyImportModule(modName)
	if module == nil {
		C.pyErrPrint()
		return nil, fmt.Errorf("failed to import tag.py")
	}
	defer C.pyDecRef(module)

	funcName := C.CString("predict")
	defer C.free(unsafe.Pointer(funcName))

	pyFunc := C.pyGetAttr(module, funcName)
	if pyFunc == nil || C.pyCallableCheck(pyFunc) == 0 {
		if pyFunc != nil {
			C.pyDecRef(pyFunc)
		}
		C.pyErrPrint()
		return nil, fmt.Errorf("tag.predict() missing or not callable")
	}
	defer C.pyDecRef(pyFunc)

	cPath := C.CString(imagePath)
	defer C.free(unsafe.Pointer(cPath))

	fmtStr := C.CString("(s)")
	defer C.free(unsafe.Pointer(fmtStr))

	args := C.pyBuildValue(fmtStr, cPath)
	if args == nil {
		C.pyErrPrint()
		return nil, fmt.Errorf("failed to build Python args")
	}
	defer C.pyDecRef(args)

	result := C.pyCallObject(pyFunc, args)
	if result == nil {
		C.pyErrPrint()
		return nil, fmt.Errorf("predict() returned NULL (Python exception)")
	}
	defer C.pyDecRef(result)

	// Check list wrapper
	if C.pyListCheck(result) == 0 {
		return nil, fmt.Errorf("predict() did not return a list")
	}

	n := int(C.pyListSize(result))
	out := make([]string, n)

	for i := 0; i < n; i++ {
		// PyList_GetItem returns a borrowed reference (no DecRef needed)
		item := C.pyListGetItem(result, C.int(i))
		if item == nil {
			return nil, fmt.Errorf("nil item at index %d", i)
		}
		if C.pyUnicodeCheck(item) == 0 {
			return nil, fmt.Errorf("item at index %d not unicode", i)
		}

		// PyUnicode_AsUTF8 returns internal buffer, valid until item is freed
		cStr := C.pyUnicodeAsUTF8(item)
		if cStr == nil {
			C.pyErrPrint()
			return nil, fmt.Errorf("failed to convert item %d to UTF8", i)
		}
		out[i] = C.GoString(cStr)
	}

	return out, nil
}

// Public entry-point, can be called from ANY Go goroutine
func Predict(imagePath string) ([]string, error) {
	ensurePythonWorker()

	reply := make(chan jobReply)
	jobChan <- job{imagePath: imagePath, reply: reply}
	resp := <-reply
	return resp.tags, resp.err
}

func unloadInternal() error {
    modName := C.CString("tag")
    defer C.free(unsafe.Pointer(modName))

    module := C.pyImportModule(modName)
    if module == nil {
        return fmt.Errorf("cannot import tag.py")
    }
    defer C.pyDecRef(module)

    funcName := C.CString("unload_model")
    defer C.free(unsafe.Pointer(funcName))

    pyFunc := C.pyGetAttr(module, funcName)
    if pyFunc == nil {
        return fmt.Errorf("no unload_model() found")
    }
    defer C.pyDecRef(pyFunc)

    args := C.Py_BuildValue(nil)
    res := C.pyCallObject(pyFunc, args)
    if res == nil {
        return fmt.Errorf("Python unload_model() failed")
    }
    C.pyDecRef(res)
    return nil
}

func UnloadModel() error {
    ensurePythonWorker()
    reply := make(chan jobReply)
    jobChan <- job{unload: true, reply: reply}
    resp := <-reply
    return resp.err
}
