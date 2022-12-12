import { Specification } from '@severlessworkflow/sdk-typescript';

type State = Specification.Sleepstate
| Specification.Eventstate
| Specification.Operationstate
| Specification.Parallelstate
| Specification.Switchstate
| Specification.Injectstate
| Specification.Foreachstate
| Specification.Callbackstate;

type StateEndOrTransition = Specification.Sleepstate
| Specification.Eventstate
| Specification.Operationstate
| Specification.Parallelstate
| Specification.Injectstate
| Specification.Foreachstate
| Specification.Callbackstate;

const transitionOrEnd = (state: State): StateEndOrTransition | null => {
    if (state instanceof Specification.Sleepstate
        || state instanceof Specification.Eventstate
        || state instanceof Specification.Operationstate
        || state instanceof Specification.Parallelstate
        || state instanceof Specification.Injectstate
        || state instanceof Specification.Foreachstate
        || state instanceof Specification.Callbackstate) {
        return state as StateEndOrTransition;
    }

    return null;
}

export class PanelWorkflowRunner {
  private workflow: Specification.Workflow;
  private lastState: any = {};
  private terminate = false;
  private currentState = "";

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

    if (!this.workflow.start) {
        throw new Error(`Workflow without start`);
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

  private states(states: State[], start: string | Specification.Startdef) {
    const statesByName: { [name: string]: State } = {};
    let haveEnd = false;
    for (const state of states) {
      statesByName[state.name!] = state;

      const stateTransitionOrEnd = transitionOrEnd(state);
      if (stateTransitionOrEnd && stateTransitionOrEnd.end) {
        haveEnd = true;
      }
    }

    if (!haveEnd) {
      throw new Error(`States without end`);
    }

    this.currentState = typeof start === 'string' ? start : start.stateName;
    while (!this.terminate) {
      if (!(this.currentState in statesByName)) {
        throw new Error(`State start not found: '${this.currentState}'`);
      }

      const lastStateExecuted = this.currentState;
      this.state(statesByName[this.currentState]);

      if (!this.terminate && lastStateExecuted === this.currentState) {
        throw new Error(`State can be executed only once: ${lastStateExecuted}`);
      }
    }
  }

  private state(state: State) {
    console.log("state", state.name);

    const stateTransitionOrEnd = transitionOrEnd(state);
    if (stateTransitionOrEnd && stateTransitionOrEnd.transition && stateTransitionOrEnd.end) {
      throw new Error("State can't defined both transition or end"); 
    }

    switch(state.type) {
      case "operation":
        this.stateOperation(state);
        break;
      default:
        throw new Error(`Invalid state type: '{state.type}'`)
    }

    if (stateTransitionOrEnd) {
      if (stateTransitionOrEnd.transition) {
        this.stateTransition(stateTransitionOrEnd.transition);
      } else if (stateTransitionOrEnd.end) {
        this.stateEnd(stateTransitionOrEnd.end);
      }
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
  }

  private runAction(action: Specification.Action, data: any) {
    console.log("runAction", "action", action.functionRef);
    if (action.functionRef) {
      const f = this.function(action.functionRef);
      return f(data);
    }
    throw new Error("runAction fail");
  }

  private function(functionRef: string | Specification.Functionref): (data: any) => string {
    return (data: any): string => {
      return `${functionRef}.start`;
    };
  }

  private stateTransition(transition: string | Specification.Transition) {
    if (typeof transition === "string") {
      this.currentState = transition;
    } else {
      transition = transition as Specification.Transition;
      this.currentState = transition.nextState;
      if (transition.produceEvents) {
        this.produceEvents(transition.produceEvents);
      }
    }
  }

  private stateEnd(end: boolean | Specification.End) {
    if (typeof(end) === "boolean") {
      this.terminate = end as boolean;
    } else {
      end = end as Specification.End;
      if (end.produceEvents) {
        this.produceEvents(end.produceEvents);
      }
      this.terminate = end.terminate as boolean;
    }
  }

  private produceEvents(produceEvents: Specification.Produceeventdef[]) {
    for (const produceEvent of produceEvents) {
        this.produceEvent(produceEvent)
    }
  }

  private produceEvent(produceEvent: Specification.Produceeventdef) {
    console.log("produceEvent", produceEvent.eventRef);
  }
}
