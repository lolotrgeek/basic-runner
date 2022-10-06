const { Node } = require("basic")
const { Store } = require("basic-store")
const { send } = require("ifttt-message")
const { log } = require("basic-log")

const node = new Node("trader")
const next_store = new Store("nexts")
const done_store = new Store("dones")

/**
 * resolves given item as `error`, `next`, or `done`
 * @param {*} item 
 * @param {function} end 
 * @returns 
 */
async function resolver(item, execute) {
    let resolved = await execute(item)
    if (!resolved) {
        log({ error: "un_resolvable" })
        await done_store.set(Date.now(), { error: "un_resolvable" })
        return await end({ error: "un_resolvable" })
    }
    else if (resolved.error) {
        await done_store.set(Date.now(), resolved)
        return await end(resolved)
    }
    else if (resolved.next) {
        log(`Next: ${resolved.key} ${resolved.next}`)
        await next_store.set(resolved.key, resolved)
        node.send("next", resolved, 500)
    }
    else if (resolved.done) {
        log(`Done: ${resolved.key} ${resolved.order.status}`)
        await done_store.set(resolved.key, resolved)
        await next_store.delete(resolved.key)
        node.send("done", resolved, 500)
    }
}

const hasNexts = next_items => typeof next_items === 'object' && Array.isArray(next_items) && next_items.length > 0
const hasAction = action => typeof action === 'function'

async function step(action, limit, execute, previous, next_items) {
    log("Step...")
    log({ previous, next_items })
    let max_calls = limit()
    if (max_calls) {
        // Will check if we're good to go every 8 seconds, once limit is lifted will resume step
        log(`Reached Limit. Waiting for Next...`, true)
        return setTimeout(async () => await step(action, limit, execute, previous, next_items), 8000)
    }
    if (hasNexts(next_items) === false) {
        log("Nexts...")
        next_items = await next_store.get_all_values()
    }
    if (hasNexts(next_items)) {
        log("Resolving...")
        node.send("nexts", next_items, 500)
        previous = Promise.allSettled(next_items.map(async item => await resolver(item, execute)))
    }
    else if (hasAction(action)) {
        log("Action...")
        let item = await action()
        previous = await resolver(item, execute)
        return setTimeout(async () => await step(action, limit, execute, previous), 5000)
    }
    return await end({error: "No Valid Action to perform.", action})
}

async function end(previous) {
    log("---End---", true)
    send({ message: "Broker stopped." })
    node.send("done", previous, 500)
    if (previous) log(previous, true)
    else {
        let dones = await done_store.get_all_values()
        let last_done = dones[dones.length - 1]
        log(last_done, true)
    }
    process.exit() // <-- NOTE: can be restarted with a process manager.
}

function alive() {
    node.send("alive", true)
    return setTimeout(alive, 2000)
}

/**
 * 
 * @param {function} initialize 
 */
async function run(action, limit, initialize) {
    alive()
    log("Starting...", true)
    let previous = 0
    let next_items = initialize ? await initialize() : []
    await step(action, limit, execute, previous, next_items)
}

module.exports = { run }