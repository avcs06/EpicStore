# IDEA
An event based state management tool. Each epic should be an encapsulated entity, it's only communication to the outside universe should be through events or commands dispatched by other epics or application.

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
* ***Updater handler SHOULD BE a pure function.*** Use scope for passing information among handlers of same epic.

## Condition
`Object<type: String, passive: Boolean, optional: Boolean, selector: Function<payload: any, type: string>, value: any> | Array<Condition>`

Updaters listen to conditions which gives more functionalities than actions.
* **type:** Action type the condition should listen on
* **passive:** Passive condition does not execute the handler when it's respective action is dispatched, but the handler will receive the latest payload if all other conditions of the updater have been met.
* An updater should have at least one non passive condition.
* **optional:** Optional condition does execute the handler when it's respective action is dispatched, but it is not necessary for this condition to be met to execute the handler.
* It is possible for multiple optional conditions to be met inside same epic cycle and handler will receive ***ALL*** the condition values.
* Passive and Optional conditions will not be fulfilled until they have a value, i.e they should have an initial value or their respective actions should have been dispatched atleast once.
* **selector:** A function to select the part or whole of payload that is needed by this condition.
* A condition is fulfilled if the value returned by selector is different from its prev value. If a new action has been dispatched but the part of the payload that the condition depends on is not changed then the condition will not be fulfilled.
* ***Selector functions SHOULD BE pure functions*** (number of executions is not gauranteed to one per cycle).
* **value:** Initial value of the condition
* **`Array<Condition> | EpicManager.anyOf(...Array<Condition>)`:** When a condition is passed as array of conditions or through anyOf modifier, the full condition set will be split into multiple condition sets.
    * **Example:** `[[A, B, C], D]` will be evaluated as three different updaters with conditions as `[A, D]`, `[B, D]`, `[C, D]` respectively, the `conditionValues` param of the handler will receive any ***ONE*** of these conditions, user should use `currentAction` param to check which action triggered this handler.

## Epic Listener
The application can directly listen to changes in epics through Epic Listener. Epic listeners are executed only after the epic cycle is completed and they ***SHOULD NOT*** dispatch new actions.

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
* External actions dispatched during an epic cycle will be considered part of the cycle.
* Any epic listeners will be informed of change in the epics only after the epic cycle is completed
* If any unhandled error occurs while processing an epic cycle, all the epics that were updated during this cycle will be reset to the values before this cycle started.

## Scope?
Scope can be considered as a normal shared scope among handlers with one additional feature, whenever the epic cycle fails all the variables inside this scope will be reverted to last known safe values.
