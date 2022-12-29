import { Specification } from '@severlessworkflow/sdk-typescript';
import { pickBy, merge } from 'lodash';

import { BusEventBase, EventBusSrv } from '@grafana/data';

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
  private eventBus: EventBusSrv;
  private data: { [name: string]: any } = {};
  private terminate = false;
  private currentState = "";

  constructor(workflow: Specification.Workflow, eventBus: EventBusSrv) {
    this.workflow = workflow
    this.eventBus = eventBus;
  }

  start() {
    console.log(this.workflow);

    this.eventBus.subscribe(WorkflowRunnerEvent, (e: WorkflowRunnerEvent) => {
        console.log("teste", e.payload.publish);
    });

    if (this.workflow.events) {
        this.events(this.workflow.events);
    }

    if (!this.workflow.start) {
        throw new Error(`Workflow without start`);
    }

    this.states(this.workflow.states, this.workflow.start);
  }

  private events(events: Specification.Events) {
    for (const event of events) {
      this.event(event);
    }
  }

  private event(event: string | Specification.Eventdef) {
    if (typeof(event) === "string") {
        console.log("onEvent", event);
    } else {
        console.log("onEvent", event.kind, event.name, event.type, event.source, event.dataOnly);
        switch(event.kind) {
          case "consumed":
            this.eventBus.subscribe(WorkflowRunnerEvent, (e: WorkflowRunnerEvent) => {
                console.log("teste", e.payload.publish);
            });
          break;
          default:
            throw new Error(`Eventdef invalid kind: '${event.kind}'`);
        }
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

      // If State not terminante and don't have transition to next state, the state can be executed only once
      if (!this.terminate && lastStateExecuted === this.currentState) {
        throw new Error(`The ${lastStateExecuted} don't have a trasition to next state.`);
      }
    }
  }

  private state(state: State) {
    console.log("state", state.name);

    const stateTransitionOrEnd = transitionOrEnd(state);
    if (stateTransitionOrEnd && stateTransitionOrEnd.transition && stateTransitionOrEnd.end) {
      throw new Error("State can't defined both transition or end"); 
    }

    let data = this.data[state.name!];
    let newData: any;

    if (state.stateDataFilter?.input) {
        data = this.dataFilter(state.stateDataFilter.input, data);
    }

    switch(state.type) {
      case "operation":
        newData = this.stateOperation(state, data);
        break;
      case "inject":
        newData = this.stateInject(state, data);
        break;
      default:
        throw new Error(`Invalid state type: '{state.type}'`)
    }

    data = this.mergeData(data, newData);

    if (state.stateDataFilter?.output) {
        data = this.dataFilter(state.stateDataFilter.output, data);
    }

    this.data[state.name!] = data;

    if (stateTransitionOrEnd) {
      if (stateTransitionOrEnd.transition) {
        this.stateTransition(stateTransitionOrEnd.transition);
      } else if (stateTransitionOrEnd.end) {
        this.stateEnd(stateTransitionOrEnd.end);
      }
    }
  }

  private stateOperation(state: Specification.Operationstate, data: any): any {
    console.log("stateOperation", "actionMode", state.actionMode, "name", state.name);
    if (state.actions) {
      if (state.actionMode === "sequential") {
        data = this.actionsSequential(state.actions, data);
      } else if (state.actionMode === "parallel") {
        throw new Error(`Invalid state actionMode: '${state.actionMode}'`)
      } else {
        throw new Error(`Invalid state actionMode: '${state.actionMode}'`)
      }
    }
    return data;
  }

  private stateInject(state: Specification.Injectstate, data: any) {
    return state.data;
  }

  private actionsSequential(actions: Specification.Action[], data: any): any {
    for (const action of actions) {
      data = this.mergeData(data, this.action(action, data));
    }
  }

  private action(action: Specification.Action, data: any): any {
    console.log("action", "action", action.functionRef);

    if (action.actionDataFilter?.fromStateData) {
        data = this.dataFilter(action.actionDataFilter.fromStateData, data);
    }

    if (action.functionRef) {
      data = this.function(action.functionRef, data);
    }

    if (action.actionDataFilter) {
        data = this.actionDataFilter(action.actionDataFilter, data);
    }

    return data;
  }

  private function(functionRef: string | Specification.Functionref, data: any): any {
    return {'function': `${functionRef}.start`};
  }

  private actionDataFilter(action: Specification.Actiondatafilter, data: any): any {
    console.log("actionDataFilter", action.useResults);

    if (typeof action.useResults !== "undefined" && !action.useResults) {
        return data;
    }

    if (action.results) {
        data = this.dataFilter(action.results, data);
    }

    if (action.toStateData) {
        data = {
            [action.toStateData]: data,
        };
    }

    return data;
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
    this.eventBus.publish(new WorkflowRunnerEvent(produceEvent.eventRef, produceEvent.data))
  }

  private mergeData(oldData: any, newData: any): any {
    return merge(oldData, newData);
  }

  private dataFilter(filter: string, data: any): any {
    const jq = new JqFilter(filter)
    return jq.run(data);
  }
}

export class WorkflowRunnerEvent extends BusEventBase {
    static type = 'panels-workflow-event';
    readonly payload?: any;

    constructor(publish: string, data: any) {
        super();
        this.payload = {
            publish,
            data,
        };
    }
}

class JqFilter {
    private tokens: any[];

    constructor(filter: string) {
        this.tokens = this.tokenizer(filter, 0, "");
    }

    tokenizer(str: string, startAt = 0, parenDepth: string): any[] {
        let ret: any[] = [];

        const isAlpha = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

        const isDigit = (c: string) => (c >= '0' && c <= '9');

        let i
        for (i = startAt; i < str.length; i++) {
            let c = str[i];
            if (c === ' ') {
                continue;
            } else if (c === '.') {
                let d = str[i+1];
                if (isAlpha(d)) {
                    i++;
                    let tok = '';
                    while (isAlpha(str[i]) || isDigit(str[i])) {
                        tok += str[i++];
                    }
                    ret.push({type: 'identifier-index', value: tok})
                    i--;
                } else if (d === '.') {
                    i++;
                    ret.push({type: 'dot-dot'});
                } else {
                    ret.push({type: 'dot'});
                }
            } else if (c === '|') {
                let d = str[i+1];
                if (d === '=') {
                    ret.push({type: 'pipe-equals'});
                    i++;
                } else {
                    ret.push({type: 'pipe'});
                }
            }
        }

        return ret;
    }

    run(data: any) {
        data = pickBy(data, (a: any, key: string) => {
            if (this.tokens[0].value === key) {
                this.tokens.shift();
                return true;
            }
            return false;
        });

        return data;
    }
}
