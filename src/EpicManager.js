function myPromisesChain(data) {
    var promise = $.when(data)
        .then(firstStep)
        .then(secondptStep);

    var counter = 0;
    var limit = 3;
    while (counter < limit) {
        promise = (function (counter) {
            return promise.then(function(data) {
                return thirdStep(data.transaction[counter]);
            });
        })(counter++);
    }

    return promise
        // ...n Step
        .then(finalStep)
        .always(function (data) {
            console.log('FINISHED: ' + JSON.stringify(data));
        });
}
