# IDEA
An event based state management tool. Each epic should be an encapsulated entity, it's only communication to the outside universe should be through events.

# Epic Manager
 
The EpicManager is a tool to manage epics, epic listeners and dispatch actions.
```
const EpicManager = require('@avcs/epicmanager')
```

## Epic
`Object<name: String, state: Object, scope: Object, updaters: Array<Updater>>`

Epic is an encapsulated entity with state and scope.
* **State:** Current state of the epic
* **Scope:** Any additional information that is not needed to be exposed by the epic, but is needed to compute the state.

**Register an Epic:**
```
EpicManager.register(<Epic>)
```
**Unegister an Epic:**
```
EpicManager.unregister(<Epic | String>)
```

## Action
`Object<type: String, payload: Any>`

There are two types of actions:
* **Internal Action:**
  An action that is dispatched, when an epic is updated
* **External Action:**
  An action that is dispatched by the application, actions dispatched by updater handlers are also considered external actions.

**Dispatch an action:**
```
EpicManager.dispatch(<Action>)
```

## Updater
`Object<conditions: Array<Condition>, handler: Function<Array<ConditionValue>, Object<state, scope, prevState, prevScope, sourceAction, currentAction, dispatch>>>`

An updater reacts to dispatched actions, handler will be executed if all the conditions are met.
* An updater handler can either update state of the epic it is linked to or dispatch more actions or both.
* Updater handler SHOULD BE a pure function. Use scope for passing information among handlers of same epic.


## Epic Listener
The application can directly listen to changes in epics through Epic Listener.

**Register an epic listener**
```
const unregister = EpicManager.addListener(conditions: Array<Condition>, handler: Function<Array<ConditionValue>, Object<sourceAction>>)
```
**Unregister an epic listener**
```
unregister()
```

## Epic cycle
Whenever an epic is updated, an internal action is dispatched with epicname as type and new epic state as payload and any updaters listening to this epic will be executed in the same cycle if conditions are met.
Which in turn can trigger simillar reaction, all the updates happened until no more actions are dispatched are considered to be one EPIC cycle.

* An epic cycle always starts with an external action.
* Any epic listeners will be informed of change in the epics only after the epic cycle is completed
* If any unhandled error occurs while processing an epic cycle, all the epics that were updated during this cycle will be reset to the values before this cycle started.

## Scope?
Scope can be considered as a normal shared scope among handlers with one additional feature, whenever the epic cycle fails all the variables inside this scope will be reverted to last known safe values.
