const { Runner } = require("../runner");
const { randomUUID } = require('crypto')

const action = () => {
    let act = { key: randomUUID(), next: "hello", count: 0 }
    console.log("act: ", act)
    return [act]
}
const execute = item => {
    let result = { key: item.key , next: item.next, count: item.count+1 }
    console.log("result", result)

    if (item.count >= 3) return { key: item.key, done: "finished", count: item.count }
    else return result
}
const runner = new Runner(action, execute)

runner.run()