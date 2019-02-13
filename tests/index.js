const env = process.env.NODE_ENV = process.env.NODE_ENV || 'test';

require('ignore-styles');
require('module-alias/register');
require('babel-register')({
    cache: env !== 'development'
});

const { register, unregister, dispatch, addListener } = require('../src/EpicManager');
const Epic = require('../src/Epic');
const Action = require('../src/Action');
const Updater = require('../src/Updater');

const Epic1 = new Epic('EPIC_1', { counter: 1 }, [
    new Updater(['USER_ACTION'], ([payload], { state, scope }) => {
        return {
            state: { counter: state.counter + 1 }
        };
    })
]);
register(Epic1);

const Epic2 = new Epic('EPIC_2', { counter: 10 }, [
    new Updater(['EPIC_1'], ([{ counter }], { state, scope }) => {
        return {
            state: { counter: state.counter - counter }
        };
    })
]);
register(Epic2);

const Epic3 = new Epic('EPIC_3', null, [
    new Updater(['EPIC_1', 'EPIC_2'], ([{ counter: counter1 }, { counter: counter2 }], { state, scope }) => {
        if (counter2 < counter1) {
            return {
                actions: [{
                    action: 'ACTION_1',
                    payload: {
                        counter1,
                        counter2
                    }
                }]
            };
        }
    })
]);
register(Epic3);

setInterval(() => {
    dispatch(new Action('USER_ACTION'));
}, 2000);
