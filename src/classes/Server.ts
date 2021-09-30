import express, { Express, Request, Response } from 'express';
import { verifyKeyMiddleware, InteractionType } from 'discord-interactions';
import rateLimiter from 'express-rate-limit';
import Context from './Context';
import type Client from './Client';

export default class Server {
  port: number;
  client: Client;
  router: Express;

  constructor(port: number, client: Client) {
    this.port = port;
    this.client = client;
    this.router = express();

    this.router.use(
      '/api/questions/',
      rateLimiter({
        windowMs: 10 * 1000,
        max: 5,
        skipFailedRequests: true,
        handler: (_: Request, res: Response) => {
          res
            .send({
              error: true,
              message: 'Too many requests, please try again later.',
            })
            .status(429);
        },
      })
    );

    this.router.post('/interactions', verifyKeyMiddleware(this.client.publicKey), (req, res) =>
      this.handleRequest(req, res)
    );

    this.router.get('/api/questions/:questionType', (req, res) => {
      const questionType = req.params.questionType;
      const rating = req.query.rating;
      if (!['dare', 'truth', 'nhie', 'wyr'].includes(questionType as string))
        return res
          .send({
            error: true,
            message: 'The question type must be one of the following: "dare" "truth" "nhie" "wyr"',
          })
          .status(400);
      if (!rating)
        return res.send(
          this.client.randomQuestion(questionType as 'dare' | 'truth' | 'nhie' | 'wyr')
        );
      if (!['PG', 'PG13', 'R'].includes(rating as string))
        return res
          .send({
            error: true,
            message: 'The rating must be one of the following: "PG" "PG13" "R"',
          })
          .status(400);
      res.send(
        this.client.randomQuestion(questionType as 'dare' | 'truth' | 'nhie' | 'wyr', [
          rating as 'PG' | 'PG13' | 'R',
        ])
      );
    });
  }

  start() {
    this.router.listen(this.port, () =>
      this.client.console.success(`Listening for requests on port ${this.port}!`)
    );
  }

  async handleRequest(req: Request, res: Response) {
    const interaction = req.body;
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const ctx = new Context(interaction, this.client, res);
      await this.handleCommand(ctx);
    }
  }

  async handleCommand(ctx: Context) {
    const command = this.client.commands.find(c => c.name === ctx.command.name);
    if (!command)
      return this.client.console.error(
        `Command ${ctx.command.name} was run with no corresponding command file.`
      );
    if (!this.client.functions.checkPerms(command, ctx)) return;
    await command.run(ctx);
    this.client.console.log(
      `${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran the ${command.name} command.`
    );
  }
}