# ADR Decorator Extension for Visual Studio Code
This project contains a prototypical implementation for a ADR decorator extension in VS code. 

The extension works with VS code and highlights given YAML configuration files for different kinds of patterns, such as, Rate Limiting, and Active Health Checks, for different providers, e.g., [Istio](https://istio.io/docs/tasks/policy-enforcement/rate-limiting/), or [Kong](https://docs.konghq.com/hub/kong-inc/rate-limiting/).

The extension creates a highlighting of a part of the configuration document which is not compliant with the defined ADR. When hovering over the highlighted lines of code, a text message appears which describes the desired state of the configuration, as defined in the corresponding ADR document.

This extension works with the project structure as defined in [pattern-config-checking
](https://github.com/kaplanan/pattern-config-checking), where the configuration templates are located in a `sources` directory under the project root and the ADR documents are located in `doc/architecture/decisions/` under the project root. 

For generating the corresponding ADR documents, a python-based CLI tool is available in [pattern-config-checking
](https://github.com/kaplanan/pattern-config-checking/blob/master/service-mesh-patterns/init.py). For using this tool, please refer to the instructions given in the linked repository.

## VSCode API

The sample code show the usage of the vscode.[`TextEditor.setDecorations`](https://code.visualstudio.com/api/references/vscode-api#TextEditor.setDecorations) and [`vscode.window.createTextEditorDecorationType`](https://code.visualstudio.com/api/references/vscode-api#window.createTextEditorDecorationType) APIs as well as the `colors` contribution point.

## Running the Extension

* `npm install` to initialize the project
* `npm run watch` to start the compiler in watch mode
* open this folder in VS Code and press `F5`
* this will open the `[Extension Development Host]` window, running the extension:
  * Open any YAML document, preferably one that defines rate limiting for Istio or Kong
  * The extension will highlight the configuration on the spot where the description of the corresponding ADR is configured and describes the current state of the config within the hover message.

![Violated ADR](https://github.com/kaplanan/vsc-adr-decorator/blob/master/media/preview_violated.png)  
![Semi compliant ADR](https://github.com/kaplanan/vsc-adr-decorator/blob/master/media/preview_semi_compliant.png)  
![Compliant with ADR](https://github.com/kaplanan/vsc-adr-decorator/blob/master/media/preview_compliant.png)