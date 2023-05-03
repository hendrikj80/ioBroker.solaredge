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
        ready: main, // SolarEdge PowerFlow API Requesti

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
    //checkStateCreationNeeded('lastUpdateTime');
    //checkStateCreationNeeded('currentPower');
    //checkStateCreationNeeded('lifeTimeData');
    //checkStateCreationNeeded('lastYearData');
    //checkStateCreationNeeded('lastMonthData');
    //checkStateCreationNeeded('lastDayData');
    checkStateCreationNeeded('load');
    checkStateCreationNeeded('pv');
    checkStateCreationNeeded('storageLevel');
    checkStateCreationNeeded('storageIn');
    checkStateCreationNeeded('storageOut');
    checkStateCreationNeeded('storageAbs');
    checkStateCreationNeeded('gridIn');
    checkStateCreationNeeded('gridOut');
    checkStateCreationNeeded('gridAbs');
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
        // powerflow start
        var resource = "currentPowerFlow";
        var url = "https://monitoringapi.solaredge.com/site/" + siteid + "/" + resource + ".json?api_key=" + apikey;

        checkStatesCreationNeeded();
        
        request({
                    url: url,
                    json: true
                },
                async function (error, response, content) {
                    if (!error && response.statusCode == 200) {
                        if (content) {
                                adapter.log.info("PowerFlow data received");
                                //var callback = function (val) {};
                                var powerflow = content.siteCurrentPowerFlow;
                                var load = powerflow.LOAD.currentPower;
                                var pv = powerflow.PV.currentPower;

                                // get storage charge level only if storage exists
                                if (powerflow.STORAGE) {
                                    var storageLevel = powerflow.STORAGE.chargeLevel;
                                }

                                var gridIn = 0.0;
                                var gridOut = 0.0;
                                var gridAbs = 0.0;
                                
                                var storageIn = 0.0;
                                var storageOut = 0.0;
                                var storageAbs = 0.0;
                              
                                
                                //Grid und Storage In/Out/Abs erzeugen
                                var connections = powerflow.connections;
                                var con = Object.keys(connections[0]);
                                con.forEach(function (junction) {
                                    adapter.log.info(junction["from"].toString() + " -> " + junction["to"].toString());
                                    switch (junction["from"]) {
                                        case "Storage":
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
                                        case "Load":
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
    
                                //Einträge in IO Broker erzeugen
                                // create states for PowerFlow
                                if (createStates) {
                                    adapter.log.debug("creating states for PowerFlow");
                                
                                    await adapter.createStateAsync('', siteid, 'load', {
                                        name: "load",
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW'
                                    });

                                    await adapter.createStateAsync('', siteid, 'pv', {
                                        name: "pv",
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW'
                                    });
        
                                    if (powerflow.STORAGE) {
                                        await adapter.createStateAsync('', siteid, 'storageLevel', {
                                            name: "storageLevel",
                                            type: 'number',
                                            read: true,
                                            write: false,
                                            role: 'value',
                                            desc: 'current chargeLevel in %'
                                        });

                                        await adapter.createStateAsync('', siteid, 'storageIn', {
                                            name: "storageIn",
                                            type: 'number',
                                            read: true,
                                            write: false,
                                            role: 'value',
                                            desc: 'current power in kW'
                                        });

                                        await adapter.createStateAsync('', siteid, 'storageOut', {
                                            name: "storageOut",
                                            type: 'number',
                                            read: true,
                                            write: false,
                                            role: 'value',
                                            desc: 'current power in kW'
                                        });

                                        await adapter.createStateAsync('', siteid, 'storageAbs', {
                                            name: "storageAbs",
                                            type: 'number',
                                            read: true,
                                            write: false,
                                            role: 'value',
                                            desc: 'current power in kW'
                                        });

                                    }
                                    await adapter.createStateAsync('', siteid, 'gridIn', {
                                        name: "gridIn",
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW'
                                    });

                                    await adapter.createStateAsync('', siteid, 'gridOut', {
                                        name: "gridOut",
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW'
                                    });

                                    await adapter.createStateAsync('', siteid, 'gridAbs', {
                                        name: "gridAbs",
                                        type: 'number',
                                        read: true,
                                        write: false,
                                        role: 'value',
                                        desc: 'current power in kW'
                                    });

                                    createStates = false;
                                }
                            
                                // update states for PowerFlow
                                adapter.log.debug("updating states");

                                await adapter.setStateChangedAsync(siteid + '.load', load, true);
                                await adapter.setStateChangedAsync(siteid + '.pv', pv, true);
                                await adapter.setStateChangedAsync(siteid + '.gridIn', gridIn, true);
                                await adapter.setStateChangedAsync(siteid + '.gridOut', gridOut, true);
                                await adapter.setStateChangedAsync(siteid + '.gridAbs', gridAbs, true);
                                if (powerflow.STORAGE) {
                                    await adapter.setStateChangedAsync(siteid + '.storageLevel', storageLevel, true);
                                    await adapter.setStateChangedAsync(siteid + '.storageIn', storageIn, true);
                                    await adapter.setStateChangedAsync(siteid + '.storageOut', storageOut, true);
                                    await adapter.setStateChangedAsync(siteid + '.storageAbs', storageAbs, true);
                                }
                        } else {
                            adapter.log.warn('Response has no valid content. Check your data and try again. ' + response.statusCode);
                        }
                    } else {
                        adapter.log.warn(error);
                    }
                    adapter.log.info("Stopping Adapter, stopping...");
                    adapter.stop();
                });
    } // Ende Else
} // Ende  Main Function

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
