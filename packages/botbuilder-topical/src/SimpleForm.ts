import { Topic, TopicInstance, TextPrompt, TopicWithChild } from './topical';
import { BotContext } from 'botbuilder';

export interface SimpleFormMetadata {
    type: 'string';
    prompt: string;
}

export interface SimpleFormSchema {
    [field: string]: SimpleFormMetadata;
}

export interface SimpleFormData {
    [field: string]: string;
}

export interface SimpleFormState {
    form: SimpleFormData;
    schema: SimpleFormSchema;
    child: string;
}

export interface SimpleFormInitArgs {
    schema: SimpleFormSchema
}

export interface SimpleFormReturnArgs {
    form: SimpleFormData;
}

interface SimpleFormPromptState {
    prompt: string;
}

export class SimpleForm <
    Context extends BotContext = BotContext
> extends TopicWithChild<SimpleFormInitArgs, SimpleFormState, SimpleFormReturnArgs, Context> {
    private textPrompt: TextPrompt<SimpleFormPromptState, Context>;

    constructor (
        name?: string
    ) {
        super(name);

        this.textPrompt = new TextPrompt<SimpleFormPromptState, Context>(this.name)
            .maxTurns(100)
            .prompter(async (context, instance, result) => {
                await context.sendActivity(instance.state.promptState.prompt);
            });

        this
            .onChildReturn(this.textPrompt, async (context, instance, childInstance) => {
                const metadata = instance.state.schema[childInstance.returnArgs.name];
        
                if (metadata.type !== 'string')
                    throw `not expecting type "${metadata.type}"`;
        
                instance.state.form[childInstance.returnArgs.name] = childInstance.returnArgs.result.value;
                this.clearChild(context, instance);

                await this.doNext(context, instance.name);
            });
    }

    async init(
        context: Context,
        instance: TopicInstance<SimpleFormState, SimpleFormReturnArgs>,
        args: SimpleFormInitArgs
    ) {
        instance.state.schema = args.schema;
        instance.state.form = {};

        await this.doNext(context, instance);
    }

    async next(
        context: Context,
        instance: TopicInstance<SimpleFormState, SimpleFormReturnArgs>,
    ) {
        for (let name of Object.keys(instance.state.schema)) {
            if (!instance.state.form[name]) {
                const metadata = instance.state.schema[name];

                if (metadata.type !== 'string')
                    throw `not expecting type "${metadata.type}"`;

                this.setChild(context, instance, await this.textPrompt.createInstance(context, instance, {
                    name,
                    promptState: {
                        prompt: metadata.prompt,
                    },
                }));
                break;
            }
        }

        if (!this.hasChild(context, instance)) {
            this.returnToParent(instance, {
                form: instance.state.form
            });
        }
    }

    async onReceive(
        context: Context,
        instance: TopicInstance<SimpleFormState, SimpleFormReturnArgs>,
    ) {
        if (!await this.dispatchToChild(context, instance))
            throw "a prompt should always be active";
    }
}
