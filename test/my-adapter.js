const APPromise = require('../src/APPromise')

module.exports = {
    deferred: APPromise.deferred,
    resolved: APPromise.resolved,
    rejected: APPromise.rejected,
}