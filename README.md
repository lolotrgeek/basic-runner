# Basic Runner
Takes an action or set of actions and runs them until they are resolved.

## Usage
```
const { Runner } = require("../src/runner")

const action = () => ({next: "something", key:"unique_key"})
const execute = item => ({done: "type", key: item.key})

const runner = new Runner(action, execute)

```

`action` function must return an object with `key` and `next` keys

`execute` function must return an object with `key` of item then must return `next` if incomplete or `done` if complete