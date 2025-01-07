/**
 * InputTesting is for lower-level testing (e.g., mouse clicks, typing, moves, etc.)
 * 
 * For many things, the ordinary view-enabled api level testing probably works well.
 */
class InputTesting {
    static specialKeys = {
        Enter: { code: "Enter", keyCode: 13 },
        Tab: { code: "Tab", keyCode: 9 },
        Backspace: { code: "Backspace", keyCode: 8 },
        Shift: { code: "ShiftLeft", keyCode: 16 },
        Control: { code: "ControlLeft", keyCode: 17 },
        Alt: { code: "AltLeft", keyCode: 18 },
        Escape: { code: "Escape", keyCode: 27 },
        ArrowUp: { code: "ArrowUp", keyCode: 38 },
        ArrowDown: { code: "ArrowDown", keyCode: 40 },
        ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
        ArrowRight: { code: "ArrowRight", keyCode: 39 },
        Space: { code: "Space", keyCode: 32 },
        Delete: { code: "Delete", keyCode: 46 }
    };
    static getKeyDetails(key) {
        if (this.specialKeys[key])  return this.specialKeys[key];

        // Handle regular printable characters (letters, numbers, symbols)
        if (key.length === 1) {
            const isUpperCase = key === key.toUpperCase() && key !== key.toLowerCase();
            const baseCode = key.toUpperCase().charCodeAt(0);
            return {
                code: isUpperCase ? `Key${key.toUpperCase()}` : `Key${key.toLowerCase()}`,
                keyCode: baseCode
            };
        }

        throw new Error(`Unsupported key: ${key}`);
    }
    mouseEvent({ref=null, x, y, button = 0, type = 'mousedown'} = {}) {
        if (ref==null && (x==null || y==null))  throw new Error('Need either ref, or x & y');

        if (!ref) {
            ref = document.elementFromPoint(x, y);
        }
        let el = q(ref);
        if (!x || !y) {
            let {x:elX,y:elY} = el.getBoundingClientRect();
            x = x ?? elX+1;
            y = y ?? elY+1;
        }
        el.dispatchEvent(new MouseEvent(type, {
            clientX: x,
            clientY: y,
            button: button || 0,
            bubbles: true,
            cancelable: true,
        }));
    }
    keyEvent(key, {ref=null, ctrlKey=false, shiftKey=false, type = 'keydown'} = {}) {
        if (!ref) {
            ref = document.getSelection().focusNode ?? document.body;
        }
        let el = q(ref);
        el.dispatchEvent(new KeyboardEvent(type, {
            key,
            ...this.constructor.getKeyDetails(key),
            bubbles: true,
            cancelable: true,
        }));
    }
    inputEvent({ref=null} = {}) {
        if (!ref) {
            ref = document.getSelection().focusNode ?? document.body;
        }
        let el = q(ref);
        el.dispatchEvent(new Event('input', {
            bubbles: true,
            cancelable: true,
        }));
    }
    keypress(key, {ref=null} = {}) {
        let opts = arguments[1] ?? {};
        if (!ref) {
            ref = document.getSelection().focusNode ?? document.body;
            ref = ref.matches ? ref : ref.parentElement;
        }
        let el = q(ref);
        this.keyEvent(key, {type:'keydown', ref});
        if (key.length==1) {
            if (el.matches('input,textarea')) {
                // Insert the key at the current cursor position
                let start = el.selectionStart;
                let end = el.selectionEnd;

                // Update the value with the new character
                el.value = el.value.slice(0, start) + key + el.value.slice(end);

                // Move the cursor to the right of the inserted character
                el.selectionStart = el.selectionEnd = start + 1;
            }
            else if (el.isContentEditable) {
                document.execCommand('insertText', false, key);
            }
        }
        this.keyEvent(key, {type:'keyup', ref});
        this.inputEvent({ref});
    }
    mousedown({ref=null, x, y, button = 0} = {}) {
        this.mouseEvent({type: 'mousedown', ...arguments[0]});
    }
    mousemove({ref=null, x, y, button = 0} = {}) {
        this.mouseEvent({type: 'mousemove', ...arguments[0]});
    }
    mouseup({ref=null, x, y, button = 0} = {}) {
        this.mouseEvent({type: 'mouseup', ...arguments[0]});
    }
    type(str, {ref=null} = {}) {
        str = typeof(str)=='string' ? [str] : str;
        for (let nextStr of str) {
            if (nextStr[0]==':') {
                this.keypress(nextStr.slice(1), {ref});
                continue;
            }
            for (let ch of nextStr) {
                this.keypress(ch, {ref});
            }
        }
    }
    click({ref=null, x, y, button = 0} = {}) {
        this.mouseEvent({type: 'mousedown', ...arguments[0]});
        this.mouseEvent({type: 'mouseup', ...arguments[0]});
        this.mouseEvent({type: 'click', ...arguments[0]});
    }
    dblclick({ref=null, x, y, button = 0} = {}) {
        this.mouseEvent({type: 'dblclick', ...arguments[0]});
    }
    wait(seconds) {
        return new Promise(r => setTimeout(r, seconds*1000));
    }
	async dragTo({ref=null, x, y, duration=0}) {
		ref = q(ref);
		this.mousedown({ref});
		if (duration) {
			let {x:origX,y:origY} = ref.getBoundingClientRect();
			let start = performance.now();
			for (let step=0;step<duration;step+=10) {
				let p = (step/duration);
				let newX = origX*(1-p) + x*p;
				let newY = origY*(1-p) + y*p;
				this.mousemove({x:newX,y:newY});
				let elapsed = performance.now() - start;
				await new Promise(r=>setTimeout(r, Math.max(0, (step+10) - elapsed)));
			}
		}
		this.mousemove({x,y});
		this.mouseup({x,y});
	}
}

function _makeSimplePromise(func, ...args) {
	return new Promise((resolve,reject) => {
		func(...args, (...callbackArgs) => {
			/// Auto convert multiple 'return' args to an array for returning
			resolve(callbackArgs.length==1 ? callbackArgs[0] : callbackArgs);
		});
	});
}

var makeSimplePromise = new Proxy(function(){}, {
	get(target, property, receiver) {
		return function(...args) {
			return _makeSimplePromise(window[property], ...args);
		};
	},
	
	apply(target, thisArg, argList) {
		var func = argList[0];
		var args = argList.slice(1);
		console.log(func, args);
		return _makeSimplePromise(func, ...args);
	},
});

let openWindows = [];

function openInWindow(el, {title=null}={}) {
	let testingProps = JSON.parse(localStorage.getItem('testing') ?? '{}');
	let posStr = testingProps.winLeft!=undefined ? `left=${testingProps.winLeft},top=${testingProps.winTop}` : '';
	let win = window.open('about:blank', 'testWindow', 'popup=yes,width=380,height=470,'+posStr);
	win.addEventListener('load', _=>{
		win.document.body.append(el);
		win.document.title = title;
		openWindows.push(win);
	});
	win.addEventListener('beforeunload', _=>{
		localStorage.setItem('testing', JSON.stringify({winLeft:win.screenLeft, winTop:win.screenTop}));
	});
	return win;
}

window.addEventListener('beforeunload', event => {
	openWindows.forEach(win => win.close());
});

var testing = {
	testingWindow: null,
	init() {
		let testingDiv = n('div',
			n('div.testing',
				n('style',`
					html, body { margin: 0; padding: 0; }
					body { padding-bottom: 15px; }
					.testing { padding: 10px; }
					.test { padding: 5px; border: solid 1px #ccc; }
					:nth-child(n + 2 of .test) { border-top: 0; }
					.test:hover { background: #eee; cursor: pointer; }
					.test {
						&[data-status=pass] { background: green; color: white; }
						&[data-status=fail] { background: red; }
						&[data-status=testError] { background: purple; }
						&[data-status=unknown] { background: #fee; }
					}
					.status { border-top: solid 1px #ccc; position: fixed; bottom: 0; z-index: 10;
						width: 100%; height: 14px; background: white; font-size: 13px; font-family: arial;
						padding: 2px 10px; }
				`),
				this.makeTestList(this.tests),
			),
			n('div.status', 'Ready'),
		);
		this.testingWindow = openInWindow(testingDiv, {title: 'GUI Testing'});
	},
	makeTestList(tests) {
		let logger = (...args) => {
			q(this.testingWindow.document, '.status').textContent = args[0];
			console.info(...args);
		}
		return Object.entries(tests).map(([name,value]) => {
			if (name == '_title') {
				return n('h2', value);
			}
			else if (typeof(value)=='object' && value != null) {
				return this.makeTestList(value);
			}
			else {
				let testFunc = value;
				return n('div.test', name, {on_click: async event=>{
					let status = null;
					let error = null;
					try {
						let res = await testFunc(logger);
						if (res === true)  status = 'pass';
						else if (res === false)  status = 'fail';
						else status = 'unknown';
					}
					catch (e) { status = 'testError'; error = e; }
					q(event.target.closest('.test')).setAttribute('data-status', status);
					if (error)  throw error;
				}});
			}
		});
	},
	tests: {
		_title: 'Basic Tests',
		'Basic inference - Asia': async function(callback) {
			await makeSimplePromise.loadFromServer('bns/Asia.xdsl');
			var savedIterations = currentBn.iterations;
			currentBn.iterations = 1000000;
			
			await new Promise(r=>app.updateBn(r));
			var xrayYesProb = Number($('#display_xray .state .prob').eq(0).text());
			var areEqual1 = testing.testNumbersEqual('xrayYesProb=0.11?', xrayYesProb, 0.11, 0.005);
			
			$('#display_dysp .stateName').eq(1).trigger('mousedown');
			await new Promise(r=>app.updateBn(r));
			var smokeYesProb = Number($('#display_smoke .state .prob').eq(0).text());
			var areEqual2 = testing.testNumbersEqual('smokeYesProb=0.4?', smokeYesProb, 0.4, 0.05);
			currentBn.iterations = savedIterations;
			
			callback('Basic Inference - Asia', areEqual1 && areEqual2);
			
			return areEqual1 && areEqual2;
		},
		'Decision Nets - Umbrella': async function(callback) {
			await makeSimplePromise.loadFromServer('bns/Umbrella.xdsl');
			var savedIterations = currentBn.iterations;
			currentBn.iterations = 1000000;

			await new Promise(r=>app.updateBn(r));
			var ev = Number($('.status .expectedValue .val').eq(0).text());
			var areEqual1 = testing.testNumbersEqual('EV=52.5?', ev, 52.5, 1);
			
			$('#display_Weather .stateName').eq(1).trigger('mousedown');
			await new Promise(r=>app.updateBn(r));
			var ev = Number($('.status .expectedValue .val').eq(0).text());
			var areEqual2 = testing.testNumbersEqual('EV=60?', ev, 60, 1);
			currentBn.iterations = savedIterations;
			callback('Decision Nets - Umbrella', areEqual1 && areEqual2);
			
			return areEqual1 && areEqual2;
		},
		'Submodels - Bunce\'s Farm': async function(callback) {
			await makeSimplePromise.loadFromServer('bns/Bunce\'s Farm.xdsl');
			var savedIterations = currentBn.iterations;
			currentBn.iterations = 1000000;

			await new Promise(r=>app.updateBn(r));
			var ev = Number($('.status .expectedValue .val').eq(0).text());
			var areEqual1 = testing.testNumbersEqual('EV=287.3?', ev, 287.3, 1);
			callback('Submodels - Bunce\'s Farm', areEqual1);
			/*$('#display_Weather .stateName').eq(1).trigger('click');
			updateBN(function() {
				var ev = Number($('.status .expectedValue .val').eq(0).text());
				var areEqual2 = testing.testNumbersEqual('EV=95?', ev, 95, 1);
				currentBn.iterations = savedIterations;
				callback('Decision Nets - Umbrella', areEqual1 && areEqual2);
			});*/
			return areEqual1;
		},
		'Formatting': async function(callback) {
			await makeSimplePromise.loadFromServer('bns/Asia.xdsl');
			$('#display_xray').trigger('contextmenu');
			$('button[data-for=format]').trigger('click');
			$('[data-object=format][name=backgroundColor]').val('#ff0000');
			$('[data-object=format][name=backgroundColor]')[0].dispatchEvent(new Event('input'));
			await new Promise(r=>setTimeout(r));
			$('.controls [name=save]').trigger('click');
			let inputBoxColor = getComputedStyle(q('[name=backgroundColor]').raw).getPropertyValue('background-color');
			let nodeColor = getComputedStyle(q('#display_xray').raw).getPropertyValue('background-color')
			let areEqual = inputBoxColor == nodeColor && nodeColor == 'rgb(255, 0, 0)';
			$('body').trigger('click');
			callback('Formatting test', areEqual);
			return areEqual;
		},
		'CPT change/edit': async function(callback) {
			await makeSimplePromise.loadFromServer('bns/Asia.xdsl');
			// Right click 'either'
			$('#display_either').trigger('contextmenu');
			// Click 'Definition' tab
			$('button[data-for=definition]').trigger('click');
			// Change to 'CPT' type
			$('.defType').val('CPT')[0].dispatchEvent(new Event('change'));
			await new Promise(r=>setTimeout(r, 100));
			console.info($('.definition td .prob'));
			// Change prob
			$('.definition td .prob').eq(0).text("0"); //[0].dispatchEvent(new Event('change'));
			$('.definition td .prob').eq(1).text("1"); //[0].dispatchEvent(new Event('change'));
			$('.definition td .prob').eq(6).text("1"); //[0].dispatchEvent(new Event('change'));
			$('.definition td .prob').eq(7).text("0"); //[0].dispatchEvent(new Event('change'));
			/// XXX: I have no idea why I have to yield here
			await new Promise(r=>setTimeout(r,5));
			$('.controls [name=save]').trigger('click');
			await testing.waitUntil(_=>currentBn.ready);
			$('body').trigger('click');
			/// Need a timeout for the change to commit
			await new Promise(r => setTimeout(r, 1000));
			currentBn.iterations = 1000000;
			await new Promise(r => app.updateBn(r));
			var eitherYesProb = Number($('#display_either .state .prob').eq(0).text());
			var areEqual1 = testing.testNumbersEqual('P(Either=Yes)=.999?', eitherYesProb, .999, 0.01);
			callback('CPT change/edit', areEqual1);
			return areEqual1;
		},
		'Undo/Redo': {
			_title: 'Undo/Redo',
			'Add node/remove node': async function(log) {
				log('Load Asia.xdsl')
				await makeSimplePromise.loadFromServer('bns/Asia.xdsl');
				
				log('Add node testNODE')
				currentBn.guiAddNode('testNODE', ['yes','no'], {pos:{x:400,y:300}, children:['dysp']});
				await testing.wait(0.5);

				log('Checking CPT before')
				let equalBefore = testing.testArrayNumsEqual(currentBn.node.dysp.def.cpt, [0.9,0.1,0.9,0.1,0.8,0.2,0.8,0.2,0.7,0.3,0.7,0.3,0.1,0.9,0.1,0.9], 0.001);
				
				log('Undoing')
				currentBn.changes.undo();
				await testing.wait(0.5);
				
				log('Checking CPT after')
				let equalAfter = testing.testArrayNumsEqual(currentBn.node.dysp.def.cpt, [.9,.1,.8,.2,.7,.3,.1,.9], 0.001);

				log('Checked')
				return equalBefore && equalAfter;
			},
			'Remove node/add node': async function(log) {
				log('Load Asia.xdsl')
				await makeSimplePromise.loadFromServer('bns/Asia.xdsl');

				log('Delete bronc node')
				currentBn.node.bronc.guiDelete();
				await testing.wait(0.5);

				let equalBefore = testing.testArrayNumsEqual(currentBn.node.dysp.def.cpt, [.8,.2,.45,.55], 0.001);
				log('Undoing')
				currentBn.changes.undo();
				await testing.wait(0.5);

				let equalAfter = testing.testArrayNumsEqual(currentBn.node.dysp.def.cpt, [.9,.1,.8,.2,.7,.3,.1,.9], 0.001);

				log('Checked')
				return equalBefore && equalAfter;
				// currentBn.node.testNODE.guiAddParents(
				//currentBn.changes.undo();
			},
		},
		'Interaction': {
			_title: 'Interaction',
			'Move node, new node, delete node': async function(log) {
				await log('Load bns/Cancer.dne');
				await makeSimplePromise.loadFromServer('bns/Cancer.dne');
				alert('Click OK to start');
				
				let tester = q(new InputTesting());

				await log('Drag X-ray to 500,400');
				await tester.dragTo({ref:'#display_Xray h6', x: 500, y:400, duration: 300});

				await log(`Create a new node by dragging out from hotspot`);
				await tester.dragTo({ref:'#display_Xray .hotSpot',x:600, y:300, duration: 300});

				await tester.wait(.5);

				await log('Name the node "Scan?"');
				tester.type(['Scan?',':Enter']);

				await tester.wait(.5);
				tester.click({ref:'.bnview',x:0,y:0});

				await tester.wait(.5);

				await log(`Delete the Dyspnoea node`);
				tester.click({ref:'#display_Dyspnoea h6'});
				await tester.wait(.5);
				tester.type([':Delete']);

				await log('Done');

				return !!(!q('#display_Dyspnoea') && q('#display_Scan_'));
			},
		},
	},

    wait(seconds) {
        return new Promise(r => setTimeout(r, seconds*1000));
    },
	numbersEqual: function(a, b, epsilon) {
		return Math.abs(a - b) < epsilon;
	},
	testNumbersEqual: function(logEntry, a, b, epsilon) {
		var areEqual = testing.numbersEqual(a, b, epsilon);
		console.log('numbersEqual', a, b, areEqual, logEntry);
		return areEqual;
	},
	testArrayNumsEqual(a, b, epsilon) {
		for (let i=0; i<a.length; a++) {
			let thisVal = a[i];
			let otherVal = b[i];
			if (!this.numbersEqual(thisVal, otherVal, epsilon)) {
				return false;
			}
		}
		return true;
	},
	async waitUntil(func, {timeout=5}={}) {
		let start = performance.now();
		while (1) {
			let result = func();
			if (result) return;
			if (performance.now() - start > timeout*1000) {
				throw new Error('Timed out waiting');
			}
			await new Promise(r=>setTimeout(r, 100));
		}
	},
	runTests: async function() {
		var numPassed = 0;
		
		for (var test of testing.tests) {
			var [testName, testResult] = await makeSimplePromise(test);
			if (testResult)  numPassed++;
			console.log('Test '+testName, 'Result:', testResult);
		}
		
		console.log('Tests finished. '+numPassed+'/'+testing.tests.length+' tests passed.');
	},
}

function testHtm() {
	var i = 0;
	var iters = 10000;

	var startTime = performance.now();
	for (i=0; i<iters; i++) {
		let node = qnode('div', 'xxx', {'class': 'gary'});
	}
	console.log(performance.now() - startTime);

	startTime = performance.now();
	for (i=0; i<iters; i++) {
		let node = document.createElement('div');
		node.appendChild( document.createTextNode('xxx') );
		node.className = 'gary';
	}
	console.log(performance.now() - startTime);

	var startTime = performance.now();
	for (i=0; i<iters; i++) {
		let node = qnode('div', 'xxx', {'class': 'gary'});
	}
	console.log(performance.now() - startTime);

	startTime = performance.now();
	for (i=0; i<iters; i++) {
		let node = document.createElement('div');
		node.appendChild( document.createTextNode('xxx') );
		node.className = 'gary';
	}
	console.log(performance.now() - startTime);
}