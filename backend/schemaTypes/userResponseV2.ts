import type { Rule } from 'sanity';

export default {
  name: 'userResponseV2',
  type: 'document',
  title: 'User Response V2',
  fields: [
    {
      name: 'section',
      type: 'string',
      title: 'Section',
      options: {
        list: [
          { title: 'Fine Arts', value: 'fine-arts' },
          { title: 'Digital / Time-Based', value: 'digital-media' },
          { title: 'Design & Applied', value: 'design' },
          { title: 'Foundations & X-Discipline', value: 'foundations' },
        ],
        layout: 'dropdown',
      },
      validation: (rule: Rule) => rule.required(), 
    },

    // answers
    { name: 'question1', type: 'string', title: 'Answer to Question 1' },
    { name: 'question2', type: 'string', title: 'Answer to Question 2' },
    { name: 'question3', type: 'string', title: 'Answer to Question 3' },
    { name: 'question4', type: 'string', title: 'Answer to Question 4' },
    { name: 'question5', type: 'string', title: 'Answer to Question 5' },

    { name: 'submittedAt', type: 'datetime', title: 'Submitted At' },
  ],
};
