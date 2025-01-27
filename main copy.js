//@ts-check
"use strict";

/*
 * Solaredge Monitoring
 * github.com/92lleo/ioBroker.solaredge
 *
 * (c) 2019 Leonhard Kuenzler (MIT)
 *
 * Created with @iobroker/create-adapter v1.18.0
 */

const utils = require("@iobroker/adapter-core");
const request = require('request');

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let createStates;
let siteid;

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: "solaredge",

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: (callback) => {
            callback();
        },
    }));
}

function checkStateCreationNeeded(stateName){
    adapter.instance
    adapter.getState('solaredge.' + adapter.instance + '.' + siteid + '.' + stateName, function (err, state) {
        if (!state) {
            adapter.log.info("state "+stateName+" does not exist, will be created");
            createStates = true;
        } else {
            adapter.log.debug("state "+stateName+" exists");
            createStates |= false;
        }
    });
}

function checkStatesCreationNeeded(){
    checkStateCreationNeeded('lastUpdateTime');
    checkStateCreationNeeded('currentPower');
    checkStateCreationNeeded('lifeTimeData');
    checkStateCreationNeeded('lastYearData');
    checkStateCreationNeeded('lastMonthData');
    checkStateCreationNeeded('lastDayData');
}

function main() {

    //SolarEdge Code Starts here
    siteid = adapter.config.siteid;
    var apikey = adapter.config.apikey;

    adapter.log.info("site id: " + siteid);
    adapter.log.info("api key: " + (apikey ? (apikey.substring(0, 4) + "...") : "not set"));

    // adapter only works with siteid and api key set
    if ((!siteid) || (!apikey)) {
        adapter.log.error("siteid or api key not set")
    } else {
        var resource = "overview";

        // for some other resources the url itself might change
        var url = "https://monitoringapi.solaredge.com/site/" + siteid + "/" + resource + ".json?api_key=" + apikey;

        checkStatesCreationNeeded();

        request({
                url: url,
                json: true
            },
            async function (error, response, content) {
                if (!error && response.statusCode === 200) {
                    if (content) {

                        var overview = content.overview;

                        adapter.log.info("Current power for " + siteid + ": " + overview.currentPower.power + " W");

                        if (createStates) {
                            adapter.log.debug("creating states");
                            // create all states, only needed on first start or after state deletion

                            // last update time
                            await adapter.createStateAsync('', siteid, 'lastUpdateTime', {
                                name: "lastUpdateTime",
                                type: 'string',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'Last update from inverter'
                            });

                            await adapter.createStateAsync('', siteid, 'currentPower', {
                                name: "currentPower",
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'current power in W'
                            });

                            await adapter.createStateAsync('', siteid, 'lifeTimeData', {
                                name: "lifeTimeData",
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'Lifetime energy in Wh'
                            });

                            await adapter.createStateAsync('', siteid, 'lastYearData', {
                                name: "lastYearData",
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'last year energy in Wh'
                            });

                            await adapter.createStateAsync('', siteid, 'lastMonthData', {
                                name: "lastMonthData",
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'last month energy in Wh'
                            });

                            await adapter.createStateAsync('', siteid, 'lastDayData', {
                                name: "lastDayData",
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'last day energy in Wh'
                            });

                            createStates = false;

                        }
                        adapter.log.debug("updating states");

                        await adapter.setStateChangedAsync(siteid + '.lastUpdateTime', overview.lastUpdateTime, true);
                        await adapter.setStateChangedAsync(siteid + '.currentPower', overview.currentPower.power, true);
                        await adapter.setStateChangedAsync(siteid + '.lifeTimeData', overview.lifeTimeData.energy, true);
                        await adapter.setStateChangedAsync(siteid + '.lastYearData', overview.lastYearData.energy, true);
                        await adapter.setStateChangedAsync(siteid + '.lastMonthData', overview.lastMonthData.energy, true);
                        await adapter.setStateChangedAsync(siteid + '.lastDayData', overview.lastDayData.energy, true);
                        
                        adapter.log.info("SolarEdge Update - Basic");
                    } else {
                        adapter.log.warn('Response has no valid content. Check your data and try again. ' + response.statusCode);
                    }
                } else {
                    adapter.log.warn(error);
                }
            });

            // powerflow start
            // getting more info from PowerFlow
            var resource = "currentPowerFlow";
            var url = "https://monitoringapi.solaredge.com/site/" + siteid + "/" + resource + ".json?api_key=" + apikey;
            request({
                    url: url,
                    json: true
                },
                function (error, response, content) {
                    if (!error && response.statusCode == 200) {
                        if (content) {
                            dapter.log.info('SolarEdge Update - PowerFlow start');

                            if(content.siteCurrentPowerFlow && !content.siteCurrentPowerFlow.length===0) {
                                var callback = function (val) {};
                                var powerflow = content.siteCurrentPowerFlow;
                                var gridIn = 0.0;
                                var gridOut = 0.0;
                                var gridAbs = 0.0;
                                var load = powerflow.LOAD.currentPower;
                                var pv = powerflow.PV.currentPower;
                                var storageIn = 0.0;
                                var storageOut = 0.0;
                                var storageAbs = 0.0;
                                // get storage charge level only if storage exists
                                if (powerflow.Storage) {
                                    var storageLevel = powerflow.STORAGE.chargeLevel;
                                }
    
                                var connections = powerflow.connections;
                                var con = Object.keys(connections[0]);
                                con.forEach(function (junction) {
                                    switch (junction["from"]) {
                                        case "STORAGE":
                                            // only LOAD is a valid target
                                            storageOut = powerflow.STORAGE.currentPower;
                                            storageAbs = -powerflow.STORAGE.currentPower;
                                            break;
                                        case "GRID":
                                            // only LOAD is a valid target
                                            gridIn = powerflow.GRID.currentPower;
                                            gridAbs = powerflow.GRID.currentPower;
                                            break;
                                        case "PV":
                                            switch (junction["to"]) {
                                                case "Load":
                                                    // nothing to handle: LOADs currentPower already available through dedicated value
                                                    break;
                                                case "Storage":
                                                    storageIn = powerflow.STORAGE.currentPower;
                                                    storageAbs = powerflow.STORAGE.currentPower;
                                                    break;
                                                default:
                                                    adapter.log.warn('Unknown target: ' + junction["to"] + ' for source: ' + junction["from"] + '.');
                                            }
                                            break;
                                        case "LOAD":
                                            switch (junction["to"]) {
                                                case "GRID":
                                                    gridOut = powerflow.GRID.currentPower;
                                                    gridAbs = -powerflow.GRID.currentPower;
                                                    break;
                                                default:
                                                    adapter.log.warn('Unknown target: ' + junction["to"] + ' for source: ' + junction["from"] + '.');
                                            }
                                        default:
                                            adapter.log.warn('Unknown source: ' + junction["from"] + '.');
                                    }
                                });
    

                               adapter.createState('', siteid, 'gridIn', {
                                    name: "gridIn",
                                    def: gridIn,
                                    type: 'number',
                                    read: true,
                                    write: false,
                                    role: 'value',
                                    desc: 'current power in kW',
                                    unit: "kW"
                                }, callback);
                                adapter.createState('', siteid, 'gridOut', {
                                    name: "gridOut",
                                    def: gridOut,
                                    type: 'number',
                                    read: true,
                                    write: false,
                                    role: 'value',
                                    desc: 'current power in kW',
                                    unit: "kW"
                                }, callback);
                                adapter.createState('', siteid, 'gridAbs', {
                                    name: "gridAbs",
                                    def: gridAbs,
                                    type: 'number',
                                    read: true,
                                    write: false,
                                    role: 'value',
                                    desc: 'current power in kW',
                                    unit: "kW"
                                }, callback);
                                adapter.createState('', siteid, 'load', {
                                    name: "load",
                                    def: load,
                                    type: 'number',
                                    read: true,
                                    write: false,
                                    role: 'value',
                                    desc: 'current power in kW',
                                    unit: "kW"
                                }, callback);
                                adapter.createState('', siteid, 'pv', {
                                    name: "pv",
                                    def: pv,
                                    type: 'number',
                                    read: true,
                                    write: false,
                                    role: 'value',
                                    desc: 'current power in kW',
                                    unit: "kW"
                                }, callback);
    
                                // create storage states only if storage exists
                                if (powerflow.Storage) {
                                    adapter.createState('', siteid, 'storageIn', {
                                        name: "storageIn",
                                        def: storageIn,
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW',
                                        unit: "kW"
                                    }, callback);
                                    adapter.createState('', siteid, 'storageOut', {
                                        name: "storageOut",
                                        def: storageOut,
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW',
                                        unit: "kW"
                                    }, callback);
                                    adapter.createState('', siteid, 'storageAbs', {
                                        name: "storageAbs",
                                        def: storageAbs,
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW',
                                        unit: "kW"
                                    }, callback);
                                    adapter.createState('', siteid, 'storageLevel', {
                                        name: "storageLevel",
                                        def: storageLevel,
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current chargeLevel in %',
                                        unit: "%"
                                    }, callback);
                                }

                                adapter.log.info('SolarEdge Update - PowerFlow');
                            } else {
                                adapter.log.info('Response for site '+siteid+' has no ressource siteCurrentPowerFlow, ignoring');
                            }
                        } else {
                            adapter.log.warn('Response has no valid content. Check your data and try again. ' + response.statusCode);
                        }
                    } else {
                        adapter.log.warn(error);
                    }
                });

                adapter.log.info("SolarEdge Fully Done, stopping...");
                adapter.stop();
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
