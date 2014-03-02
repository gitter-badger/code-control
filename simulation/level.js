var fs = require('fs'),
util = require('./util'),
run = require('./runner'),
baseEnt = require('./entities/base'),
Runner = run.Runner,
Controllable = baseEnt.Controllable,
ControlException = baseEnt.ControlException,
Grid = util.Grid,
Tile = util.Tile,
Point = util.Point;

const MAX_TURNS = 5;
function Player(idx) {
    this.idx = idx;
    this.ents = {};
}

const P_A = 0, P_B = 1;

function BattleLevel(codeA, codeB, jsonPath, finishCb) {
    var entities = {},
    updateIdx = [], moveDel = [],
    def, self = this, turn = 0, replay = [],
    runner = new Runner('./api', [codeA, codeB], loadMap, errBack, 1000);
    this.players = [new Player(P_A), new Player(P_B)];
    this.grid = null;
    this.tSet = {};

    function isFinished() {
        return turn > MAX_TURNS;
    }

    function gameOver() {
        var numA = Object.keys(self.players[P_A]).length,
        numB = Object.keys(self.players[P_B]).length;
        if(numA > numB) {
            setImmediate(finishCb, { win: P_A, replay: replay });
        } else if(numB > numA) {
            setImmediate(finishCb, { win: P_B, replay: replay });
        } else {
            setImmediate(finishCb, { draw: null, replay: replay});
        }
    }

    function spawnEvent(ent) {
        addEvent('spawn', util.copy(ent));
    }
    this.spawnEvent = spawnEvent;

    function logEvent(log_obj) {
        addEvent('log', log_obj)
    }
    function shakeEvent(idx) {
        addEvent('shake', idx);
    }
    function moveEvent(idx, pos) {
        addEvent('move', {
            idx: idx,
            pos: pos.clone(),
        });
    }
    this.moveEvent = moveEvent;

    function addEvent(type, data) {
        var event = {};
        event[type] = data;
        replay.push(event);
    }

    function errBack(e) {
        console.log(e);
        console.log('INV_CODE Error, must die..');
        process.exit(7);
    }

    function doSpawn(team, i, j) {
    
    }

    function updateEntCallback(ent, i) {
        return function(x, dat) {
            if(!x) {
                console.log('[ERROR] in update of Player ' + ent.team + '\'s, entity: ' + ent.idx);
                console.log(dat.toString());
            } else {
                try {
                    ent.update(dat);
                    var logs = runner.flushStr(i);
                    if(logs.out != ''){
                        logEvent(logs);
                    }
                } catch(e) {
                    console.log('[ERROR] in parsing update result of Player ' + ent.team + '\'s, entity: ' + ent.idx);
                    console.log(e.toString());
                }
            }
            setImmediate(act, i + 1);
        }
    }

    function getParams(ent) {
        return {
            entities: entities,
            grid: self.grid 
        };
    }


    function loadMap() {
        if(++loadMap.count < 2) {
            return;
        }
        fs.readFile(jsonPath, { encoding: 'utf8' }, fReadCback);
    }
    loadMap.count = 0;

    function fReadCback(err, d) {
        if(err) {
            throw err;
        }
        def = JSON.parse(d);
        self.grid = new Grid(def.height, def.width);
        // Building tilesets
        for(key in def.tiledata) {
            if(def.tiledata.hasOwnProperty(key)) {
                self.tSet[key] = new Tile(def.tiledata[key], key);
            }
        }
        self.grid.loadTilemap(def.data, self.tSet);
        //DEBUG!?
        doDebug();
        start();
    }

    function doDebug() {
        addEntity(new Controllable(0, 0, 0, self, 100));
        addEntity(new Controllable(1, 0, 1, self, 100));
    }

    function start() {
        setImmediate(act, 0);
    }

    function destroy(i) {
        moveDel.push(i);
    }

    function pushDelete(idx) {
        var i, delI, nI = updateIdx[idx];
        while(moveDel.find(nI) != -1) {
            idx += 1;
            if(idx >= updateIdx.length) {
                nI = -1;
                break;
            }
            nI = updateIdx[idx];
        }
        for(i = 0; i < moveDel.length; i++) {
            delI = moveDel[i];
            updateIdx.splice(updateIdx.indexOf(delI), 1);
            delete entities[delI];
        }
        moveDel = [];
        return updateIdx.find(nI);
    }

    function act(i) {
        if(moveDel.length != 0) {
            i = pushDelete(i);
        }
        if(i >= updateIdx.length || i < 0) {
            turn += 1;
            // LOOP DONE
            // UPDATE REST!?
            // ADD HOOK for next
            if(isFinished()) {
                gameOver();
            } else {
                setImmediate(start);
            }
            return false;
        }
        var ent = entities[updateIdx[i]];
        if(ent instanceof Controllable) {
            runner.runCode(ent.team, getParams(ent), updateEntCallback(ent, i), 'update', 2000);
        } else {
            ent.update();
        }
        return true;
    }

    function addEntity(ent) {
        entities[ent.idx] = ent;
        updateIdx.push(ent.idx);
    }

    function getGameState() {
        return entities;
    }
    this.getGameState = getGameState;

}



module.exports.BattleLevel = BattleLevel;
