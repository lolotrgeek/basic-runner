const { Node } = require("basic-messaging")
const { Store } = require("basic-store")
const { send } = require("ifttt-message")
const { log } = require("basic-log")
const noop = () => { }

class Runner {
    constructor(action, execute, limit, initialize) {
        this.action = typeof action === 'function' ? action : noop
        this.limit = typeof limit === 'function' ? limit : noop
        this.execute = typeof execute === 'function' ? execute : noop
        this.initialize = typeof initialize === 'function' ? initialize : () => []
        this.node = new Node("runner") // todo: arg for name
        this.next_store = new Store("nexts")
        this.done_store = new Store("dones")
    }

    alive() {
        this.node.send("alive", true)
        return setTimeout(this.alive, 2000)
    }
    async resolver(item) {
        let resolved = await this.execute(item)
        if (!resolved) {
            log({ error: "un_resolvable" }, true)
            await this.done_store.set(Date.now(), { error: "un_resolvable" })
            return await this.end({ error: "un_resolvable" })
        }
        else if (resolved.error) {
            await this.done_store.set(Date.now(), resolved)
            return await this.end(resolved)
        }
        else if (resolved.next) {
            log(`Next: ${resolved.key} ${resolved.next}`, true)
            await this.next_store.set(resolved.key, resolved)
            this.node.send("next", resolved, 500)
        }
        else if (resolved.done) {
            log(`Done: ${resolved.key} ${resolved.done}`, true)
            await this.done_store.set(resolved.key, resolved)
            await this.next_store.delete(resolved.key)
            this.node.send("done", resolved, 500)
        }
        
    }
    hasNexts = next_items => typeof next_items === 'object' && Array.isArray(next_items) && next_items.length > 0

    async step(next) {
        log("Step...", true)
        log({ next })
        let max_calls = this.limit()
        if (max_calls) {
            // Will check if we're good to go every 8 seconds, once limit is lifted will resume step
            log(`Reached Limit. Waiting for Next...`, true)
            return setTimeout(async () => await this.step(next), 8000)
        }
        if (this.hasNexts(next) === false) {
            log("Nexts...")
            next = await this.next_store.get_all_values()
        }
        if (this.hasNexts(next)) {
            log("Resolving...", true)
            log({next}, true)
            this.node.send("nexts", next, 500)
            await Promise.allSettled(next.map(async item => await this.resolver(item)))
            return setTimeout(async () => await this.step(), 5000)
        }
        else {
            log("Action...", true)
            let next_items = await this.action()
            return setTimeout(async () => await this.step(next_items), 5000)
        }
    }

    async run() {
        // this.alive()
        log("Starting...", true)
        await this.step(await this.initialize())
    }

    async end(previous) {
        log("---End---", true)
        send({ message: "Runner stopped." })
        this.node.send("done", previous, 500)
        if (previous) log(previous, true)
        else {
            let dones = await this.done_store.get_all_values()
            let last_done = dones[dones.length - 1]
            log(last_done, true)
        }
        process.exit() // <-- NOTE: can be restarted with a process manager.
    }
}

module.exports = { Runner }