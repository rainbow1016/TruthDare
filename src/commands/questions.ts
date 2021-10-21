import { ApplicationCommandOptionType } from 'discord-api-types';
import { QuestionType } from '.prisma/client';

import type { Mutable } from '../classes/OptionTypes';
import type Command from '../classes/Command';
import type Context from '../classes/Context';

const { MAIN_GUILD } = process.env;
const PER_PAGE = 15;
const options = [
  {
    type: ApplicationCommandOptionType.Subcommand,
    name: 'list',
    description: 'List all the custom questions added so far',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'type',
        description: 'The type of question to list',
        choices: [
          { name: 'all', value: 'ALL' },
          { name: 'truth', value: 'TRUTH' },
          { name: 'dare', value: 'DARE' },
          { name: 'wyr', value: 'WYR' },
          { name: 'nhie', value: 'NHIE' },
          { name: 'paranoia', value: 'PARANOIA' },
        ],
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'rating',
        description: 'The rating of questions to list',
        choices: [
          { name: 'all', value: 'ALL' },
          { name: 'PG', value: 'PG' },
          { name: 'PG13', value: 'PG13' },
          { name: 'R', value: 'R' },
        ],
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'page',
        description: 'The page number of questions of list',
      },
    ],
  },
  {
    type: ApplicationCommandOptionType.Subcommand,
    name: 'add',
    description: 'Adds a new custom question for this server',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'type',
        description: 'The type of question to add',
        choices: [
          { name: 'truth', value: 'TRUTH' },
          { name: 'dare', value: 'DARE' },
          { name: 'wyr', value: 'WYR' },
          { name: 'nhie', value: 'NHIE' },
          { name: 'paranoia', value: 'PARANOIA' },
        ],
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'rating',
        description: 'The rating of question to add',
        choices: [
          { name: 'PG', value: 'PG' },
          { name: 'PG13', value: 'PG13' },
          { name: 'R', value: 'R' },
        ],
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'question',
        description: 'The question to add',
        required: true,
      },
    ],
  },
  {
    type: ApplicationCommandOptionType.Subcommand,
    name: 'remove',
    description: 'Removes a custom question from this server',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'id',
        description: 'The id of the question to remove (get the ID using /customquestion list)',
        required: true,
      },
    ],
  },
] as const;

const questions: Command = {
  name: 'questions',
  description: 'List, add, and remove custom questions for this server',
  category: 'control',
  perms: ['ManageGuild'],
  options,
  run: async (ctx: Context) => {
    if (!ctx.guildId)
      return ctx.reply(`${ctx.client.EMOTES.xmark} Custom questions cannot be edited in DMs`);

    if (!(await ctx.client.database.isPremiumGuild(ctx.guildId)))
      return ctx.reply(ctx.client.functions.premiumAd());

    if (ctx.args[0] === 'list') {
      const questionType =
        ctx.getOption<Mutable<typeof options[0]['options'][0]>>('type')?.value || 'ALL';
      const rating =
        ctx.getOption<Mutable<typeof options[0]['options'][1]>>('rating')?.value || 'ALL';

      const questions =
        ctx.guildId === MAIN_GUILD
          ? ctx.client.database.getQuestions(
              questionType === 'ALL' ? undefined : questionType,
              rating === 'ALL' ? undefined : rating
            )
          : ctx.client.database.getCustomQuestions(
              ctx.guildId,
              questionType === 'ALL' ? undefined : questionType,
              rating === 'ALL' ? undefined : rating
            );

      const page = Math.min(
        Math.max(ctx.getOption<Mutable<typeof options[0]['options'][2]>>('page')?.value || 1, 1),
        Math.ceil(questions.length / PER_PAGE)
      );

      const titleCase = ctx.client.functions.titleCase;
      // TODO: Buttons
      return ctx.reply({
        embeds: [
          {
            title: `${titleCase(questionType)} ${titleCase(
              rating
            )} Custom Questions | Page ${page}`,
            description:
              questionType === 'ALL'
                ? Object.values(QuestionType)
                    .map(
                      type =>
                        `${type}: ${questions.reduce(
                          (total, q) => total + (q.type === type ? 1 : 0),
                          0
                        )}`
                    )
                    .join('\n')
                : `Total ${titleCase(questionType)} Questions: ${questions.length}`,
            fields: questions.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(q => ({
              name: q.question,
              value: `Type: ${q.type} | Rating: ${q.rating} | ID: ${q.id}`,
            })),
            footer: {
              text: 'Page ' + page,
            },
          },
        ],
      });
    } else if (ctx.args[0] === 'add') {
      const type = ctx.getOption<Mutable<typeof options[1]['options'][0]>>('type').value;
      const rating = ctx.getOption<Mutable<typeof options[1]['options'][1]>>('rating').value;
      const question = ctx.getOption<Mutable<typeof options[1]['options'][2]>>('question').value;

      if (question.length > 256) return ctx.reply('Maximum question length is 256 characters');

      const addedQuestion = await (ctx.guildId === MAIN_GUILD
        ? ctx.client.database.updateQuestion('', { type, rating, question })
        : ctx.client.database.addCustomQuestion({
            guildId: ctx.guildId,
            type,
            rating,
            question,
          }));

      if (ctx.guildId !== MAIN_GUILD)
        await ctx.client.webhookLog('suggest', {
          username: `${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id})`,
          avatar_url: ctx.client.functions.avatarURL(ctx.user),
          embeds: [
            {
              color: ctx.client.COLORS.BLUE,
              title: question,
              footer: { text: `Type: ${type} | Rating: ${rating}` },
            },
          ],
        });

      return ctx.reply(`${ctx.client.EMOTES.checkmark} Question Added. ID: ${addedQuestion.id}`);
    } else if (ctx.args[0] === 'remove') {
      const id = ctx.getOption<Mutable<typeof options[2]['options'][0]>>('id').value;

      const deleted = await (ctx.guildId === MAIN_GUILD
        ? ctx.client.database.deleteQuestion(id)
        : ctx.client.database.deleteCustomQuestion(id));
      return ctx.reply({
        embeds: [
          ctx.client.functions.embed(
            deleted
              ? `Question removed. ID: ${deleted.id}`
              : 'Something went wrong, maybe the question has already been deleted?',
            ctx.user,
            !!deleted
          ),
        ],
      });
    }
  },
};

export default questions;
