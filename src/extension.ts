import * as vscode from 'vscode';
const yaml = require('js-yaml');


// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
	let message: string = '';

	console.log('decorator sample is activated');

	let timeout: NodeJS.Timer | undefined = undefined;

	// create a decorator type for violation annotations
	const violationDecorationType = vscode.window.createTextEditorDecorationType({
		borderWidth: '10px',
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		light: {
			// this color will be used in light color themes
			borderColor: 'darkblue'
		},
		dark: {
			// this color will be used in dark color themes
			borderColor: 'lightblue'
		}
	});

	let activeEditor = vscode.window.activeTextEditor;

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}

		const text = activeEditor.document.getText();
		const docs: any = yaml.loadAll(text);

		let provider: string = '';
		for (let doc of docs) {
			if (doc['kind'] != undefined) {
				provider = 'istio';
			}
		}

		let matchClause: string = '';
		switch(provider) {
			case 'istio': {
				/*
				let filepath = activeEditor.document.uri.path.substring(0, activeEditor.document.fileName.lastIndexOf('\\'));
				filepath = filepath.substring(0, filepath.lastIndexOf('/')) + '/doc/architecture/decisions/rate_limit_adr_0001.md';
				const fileReader = new FileReader();
				const file = new File([filepath], 'rate_limit_adr_0001');
				let fileContent: string = '';
				fileReader.onload = (e) => { fileContent = (<string>fileReader.result); }
				fileReader.readAsText(file);
				message = fileContent;
				*/

				/*
				const readline = require('readline');
				const fs = require('fs');
				const readInterface = readline.createInterface({ // TODO: SOLVE THIS SOMEHOW!
					input: fs.createReadStream(filepath),
					output: process.stdout,
					console: false
				});

				let isConfig: boolean = false;
				let configSet: string = '';
				readInterface.on('line', function(line: string) {
					if (isConfig) { 
						configSet = line;
						isConfig = false; 
					}
					if (line.match('/## Config Set/gm')) { 
						isConfig = true; 
						message = "match";
					}
					//message = 'hello';
				});
				
				let configProps = JSON.parse(configSet);
				let config_destination: string = configProps.destination;
				let config_rate: string = configProps.requestrate;
				let config_interval: string = configProps.interval;
				 */
				
				let config_destination: string = 'reviews';
				let config_rate: string = '90';
				let config_interval: string = '75s';
				

				for (let doc of docs) {
					if (doc['kind'] == 'handler') {
						let config_quota_handler = doc;
						let quotas;
						if (config_quota_handler) { quotas = config_quota_handler['spec']['params']['quotas'][0]; } 
						else { return 'No memquota found in this template file'; }
        				let template_rate = quotas['maxAmount'];
        				let template_interval = quotas['validDuration'];
        				let overrides: {[key: string]: {[key: string]: string}}[] = quotas['overrides'];
        				let quota_override: {[key: string]: {[key: string]: string}} = {};
        				for (quota_override of overrides) {
        				    if (config_destination == quota_override['dimensions']['destination']) {
        				        template_rate = quota_override['maxAmount'];
								template_interval = quota_override['validDuration'];
								matchClause = 'destination: ' +  quota_override['dimensions']['destination'];
        				    }
						}
						let rate: string = '';
						if (config_rate != template_rate) { rate = config_rate; } else { rate = 'compliant'; }
						let interval: string = '';
						if (config_interval != template_interval) { interval = config_interval; } else { interval = 'compliant'; }
						if (rate != 'compliant' || interval != 'compliant') { 
							message = 'ADR violated: ' + '<rate: ' + rate + '> <interval: ' + interval + '>'; 
						} else {
							message = 'Compliant with ADR';
						}
						
					}
				}
				

			}
		}
		
		const regEx = new RegExp(matchClause, 'g');
		const violationTags: vscode.DecorationOptions[] = [];
		let match;
		while (match = regEx.exec(text)) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: message};
			violationTags.push(decoration);
		}
		activeEditor.setDecorations(violationDecorationType, violationTags);
	}

	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		timeout = setTimeout(updateDecorations, 500);
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

}

