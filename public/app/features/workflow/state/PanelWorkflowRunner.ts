import { Specification } from '@severlessworkflow/sdk-typescript';

type State = Specification.Sleepstate
| Specification.Eventstate
| Specification.Operationstate
| Specification.Parallelstate
| Specification.Switchstate
| Specification.Injectstate
| Specification.Foreachstate
| Specification.Callbackstate;

export class PanelWorkflowRunner {
  private workflow: Specification.Workflow;
  private lastState: any = {};
  private terminate = false;

  constructor(workflow: Specification.Workflow) {
    this.workflow = workflow
  }

  start() {
    console.log(this.workflow);

    if (this.workflow.events) {
      for (const event of this.workflow.events) {
        this.event(event);
      }
    }

    this.states(this.workflow.states, this.workflow.start);
  }

  private event(event: Specification.Eventdef) {
    console.log("onEvent", event.kind, event.name, event.type, event.source, event.dataOnly);

    switch(event.kind) {
      case "consumed":

      break;
      default:
        throw new Error(`Eventdef invalid kind: '${event.kind}'`);
    }
  }

  private states(states: State[], start?: string | Specification.Startdef) {
    const statesByName: { [name: string]: State } = {};
    for (const state of states) {
      statesByName[state.name!] = state;
    }

    if (start) {
      const stateStart = typeof start === 'string' ? start : start.stateName;
      if (stateStart in statesByName) {
        this.state(statesByName[stateStart]);
      } else {
        throw new Error(`State start not found: '${stateStart}'`);
      }
      
    } else {
      for (const state of states) {
        this.state(state);
        if (this.terminate) {
          break;
        }
      }
    }
  }

  private state(state: State) {
    switch(state.type) {
      case "operation":
        this.stateOperation(state);
        break;
      default:
        throw new Error(`Invalid state type: '{state.type}'`)
    }
  }

  private stateOperation(state: Specification.Operationstate) {
    console.log("stateOperation", "actionMode", state.actionMode, "name", state.name);
    if (state.actions) {
      if (state.actionMode === "sequential") {
        for (const action of state.actions) {
          this.lastState = this.runAction(action, this.lastState);
        }
      } else if (state.actionMode === "parallel") {
        throw new Error(`Invalid state actionMode: '${state.actionMode}'`)
      } else {
        throw new Error(`Invalid state actionMode: '${state.actionMode}'`)
      }
    }

    if (state.end) {
      this.end(state.end);
    }
    this.lastState = {};
  }

  private runAction(action: Specification.Action, data: any) {
    console.log("runAction", "action", action.functionRef)
    if (action.functionRef) {
      const f = this.function(action.functionRef);
      return f(data);
    }
    throw new Error("runAction fail")
  }
  
  private function(functionRef: string | Specification.Functionref): (data: any) => string {
    return (data: any): string => {
      return `${functionRef}.start`;
    };
  }

  private end(end: boolean | Specification.End) {
    if (typeof(end) !== "boolean") {
      for (const produceEvent of end.produceEvents!) {
        this.produceEvent(produceEvent)
      }
      if (end.terminate) {
        this.terminate = true;
      }
    }
  }

  private produceEvent(produceEvent: Specification.Produceeventdef) {
    console.log("produceEvent", produceEvent.eventRef);
  }
}
