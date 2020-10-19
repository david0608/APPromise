const PENDING = "PENDING"
const FULFILLED = "FULFILLED"
const REJECTED = "REJECTED"

class APPromise {
    constructor(executor, onFulfilled, onRejected) {
        // Child promises to be processed when this promise transpose.
        this.childs = []
        // Handler when parent promise fulfilled.
        this.onFulfilled = onFulfilled
        // Handler when parent promise rejected.
        this.onRejected = onRejected
        // Current promise state.
        this.state = PENDING
        // The fulfilled value or the rejected value of this promise.
        this.value = null

        if (typeof executor === 'function') {
            try {
                executor(
                    result => this.process(FULFILLED, result),
                    reason => this.process(REJECTED, reason),
                )
            } catch (err) {
                // Reject this promise with the exception thrown by executor.
                this.process(REJECTED, err)
            }
        } else {
            throw new TypeError(`Promise executor ${executor} is not a function.`)
        }
    }

    // Transpose this promise and process child promises with current state and value.
    transpose(into, value) {
        if (this.state !== PENDING || this.state === into) return

        this.state = into
        this.value = value
        for (const child of this.childs) {
            child.process(into, value)
        }
    }

    // Process current promise into `into` state with value `value`.
    process(into, value) {
        let handler = into === FULFILLED ? this.onFulfilled : this.onRejected

        // If handler is not a function, ignore it.
        if (typeof handler === 'function') {
            // Handler must not be called until the execution context stack contains only platform code.
            setTimeout(() => {
                try {
                    // Call handler with no `this` argument.
                    const handleResult = handler.call(undefined, value)
                    // Execute resolve with the return value from handler.
                    this.resolve(FULFILLED, handleResult)
                } catch (err) {
                    // Reject this promise if there an exception thrown during handler execution.
                    this.transpose(REJECTED, err)
                }
            }, 0)
        } else {
            this.resolve(into, value)
        }
    }

    // Resolve current promise into `into` state with value `value`.
    resolve(into, value) {
        if (value === this) {
            // Throw a TypeError if this and value refer to the same object.
            this.transpose(REJECTED, new TypeError("Chaining cycle detected for promise"))
        } else {
            if (value && (typeof value === 'function' || typeof value === 'object')) {
                let locked = false
                try {
                    // Take reference to then function, avoids multiple accesses to the then property.
                    const then = value.then
                    if (then && typeof then === 'function') {
                        // Call then function of the thenable with resolvePromise and rejectPromise as arguments.
                        // If both resolvePromise and rejectPromise are called, or multiple calls to the same argument 
                        // are made, the first call takes precedence, and any further calls are ignored.
                        then.call(
                            value,
                            result => {
                                if (locked) return
                                locked = true
                                this.resolve(FULFILLED, result)
                            },
                            reason => {
                                if (locked) return
                                locked = true
                                this.transpose(REJECTED, reason)
                            },
                        )
                    } else {
                        // Value is not thenable, transpose directly
                        this.transpose(into, value)
                    }
                } catch (err) {
                    // Exception thrown while retrieving value.then or calling then.
                    // Ignore the exception if resolvePromise or rejectPromise was called, or reject this promise otherwise.
                    if (locked) return
                    locked = true
                    this.transpose(REJECTED, err)
                }
            } else {
                // value is not thenable, transpose directly
                this.transpose(into, value)
            }
        }
    }

    // Then method.
    then(onFulfilled, onRejected) {
        const thenPromise = new APPromise(
            (resolve, reject) => {
                // Directly transpose the promise just created if this promise have fulfilled or rejected.
                if (this.state === FULFILLED) {
                    resolve(this.value)
                } else if (this.state === REJECTED) {
                    reject(this.value)
                }
            },
            onFulfilled,
            onRejected,
        )

        this.childs.push(thenPromise)

        return thenPromise
    }

    // Create a resolved promise.
    static resolved(value) {
        const promise = new APPromise(() => {})
        promise.state = FULFILLED
        promise.value = value
        return promise
    }

    // Create a rejected promise.
    static rejected(reason) {
        const promise = new APPromise(() => {})
        promise.state = REJECTED
        promise.value = reason
        return promise
    }

    static deferred() {
        const promise = new APPromise(() => {})
        return {
            promise: promise,
            resolve: value => promise.process.bind(promise)(FULFILLED, value),
            reject: reason => promise.process.bind(promise)(REJECTED, reason),
        }
    }
}

module.exports = APPromise