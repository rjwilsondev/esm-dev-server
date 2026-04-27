import { subtract } from "lodash-es"

export function add(x,y) {
    console.log("\n\nADDING!! WOOOOOOOOO\n\n")
    return subtract(x, y * -1)
}
