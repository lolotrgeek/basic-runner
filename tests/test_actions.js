const { Runner } = require("../runner");
const { randomUUID } = require('crypto')

const action = () => {
    let actions = [{ key: randomUUID(), next: "hello", count: 0 }, { key: randomUUID(), next: "world", count: 0 }]
    console.log("actions: ", actions)
    return actions
}
const execute = item => {
    let result = { key: item.key , next: item.next, count: item.count+1 }
    console.log("result", result)

    if (item.count >= 3) return { key: item.key, done: "finished", count: item.count }
    else return result
}
const runner = new Runner(action, execute)

runner.run()