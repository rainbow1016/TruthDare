import { readdirSync } from 'fs';
import Logger from './Logger.js';
import Server from './Server.js';
import Command from './Command.js';
import Functions from './Functions.js';

export default class Client {
  token: string;
  id: string;
  publicKey: string;
  port: number;
  commands: Command[];
  console: Logger;
  functions: Functions;
  server: Server;
  questions: any;
  COLORS: {
    readonly WHITE: 16777215;
    readonly BLURPLE: 5793266;
    readonly GREYPLE: 10070709;
    readonly DARK_BUT_NOT_BLACK: 2895667;
    readonly NOT_QUITE_BLACK: 2303786;
    readonly GREEN: 5763719;
    readonly YELLOW: 1044092;
    readonly FUSCHIA: 15418782;
    readonly RED: 15548997;
    readonly BLACK: 16777215;
    readonly BLUE: 3447003;
  };
  EMOTES: {
    readonly checkmark: ':white_check_mark:';
    readonly xmark: ':x:';
    readonly time: ':stopwatch:';
  };

  constructor({
    token,
    applicationId,
    publicKey,
    port,
  }: {
    token: string;
    applicationId: string;
    publicKey: string;
    port: number;
  }) {
    this.token = token;
    this.id = applicationId;
    this.publicKey = publicKey;
    this.port = port;

    this.commands = [];
    this.console = new Logger('ToD');
    this.functions = new Functions();
    this.server = new Server(this.port, this);

    this.questions = {};
    this.COLORS = {
      WHITE: 0xffffff,
      BLURPLE: 0x5865f2,
      GREYPLE: 0x99aab5,
      DARK_BUT_NOT_BLACK: 0x2c2f33,
      NOT_QUITE_BLACK: 0x23272a,
      GREEN: 0x57f287,
      YELLOW: 0xfee7c,
      FUSCHIA: 0xeb459e,
      RED: 0xed4245,
      BLACK: 0xffffff,
      BLUE: 0x3498db,
    } as const;
    this.EMOTES = {
      checkmark: ':white_check_mark:',
      xmark: ':x:',
      time: ':stopwatch:',
    } as const;
  }

  async start() {
    this.console.log(`Starting Truth or Dare...`);
    await this.loadCommands();
    this.console.success(`Loaded ${this.commands.length} commands!`);
    // Eventually post slash commands
    // await this.loadQuestions();
    this.server.start();
  }

  async loadCommands() {
    const commandFileNames = readdirSync(`${__dirname}/../src/commands`).filter(f =>
      f.endsWith('.js')
    );
    for (const commandFileName of commandFileNames) {
      const commandName = commandFileName.split('.js')[0];
      const commandFile: typeof Command = (await import(`../src/commands/${commandFileName}`))
        .default;
      const command = new commandFile(commandName, this);
      this.commands.push(command);
    }
  }
}
