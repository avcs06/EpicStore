export default class Epic {
    constructor(name, state, scope, updaters) {
        this.name = name;
        this.state = state;
        this.scope = scope;
        this.updaters = updaters;
    }
}
