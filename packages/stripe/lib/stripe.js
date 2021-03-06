const stripe = require('stripe');

module.exports = class Stripe {
  constructor(options = {}) {
    this.stripe = stripe(options.key);
    this.model = options.model;
  }

  async createCard({ userId, sourceId, description }) {
    const user = await this.model.retrieveUserbyId(userId);

    if (!user.stripeId) {
      /* if stripe id does not exist, create stripe customer */
      const customer = await new Promise((resolve, reject) => {
        this.stripe.customers.create(
          {
            email: user.email,
            source: sourceId,
            description,
          },
          (err, data) => {
            if (err) reject(err);
            resolve(data);
          },
        );
      });

      return this.model.bindStripeToUser({
        sourceId,
        cardId: customer.default_source,
        stripeId: customer.id,
        userId,
      });
    }

    /* if stripe id exist, append card to existing stripe id */
    const card = await new Promise((resolve, reject) => {
      this.stripe.customers.createSource(
        user.stripeId,
        { source: sourceId },
        (err, data) => {
          if (err) reject(err);
          resolve(data);
        },
      );
    });

    return this.model.bindStripeToUser({
      sourceId,
      cardId: card.id,
      stripeId: user.stripeId,
      userId,
    });
  }

  async updateCard({
    cardId,
    userId,
    address_city,
    address_country,
    address_line1,
    address_line2,
    address_state,
    address_zip,
    exp_month,
    exp_year,
    name,
  }) {
    const card = await this.model.retrieveCard(cardId, userId);

    await new Promise((resolve, reject) => {
      this.stripe.customers.updateCard(
        card.stripeId,
        card.cardId,
        {
          address_city,
          address_country,
          address_line1,
          address_line2,
          address_state,
          address_zip,
          exp_month,
          exp_year,
          name,
        },
        (err, data) => {
          if (err) reject(err);
          resolve(data);
        },
      );
    });

    return card;
  }

  async deleteCard({ cardId, userId }) {
    const card = await this.model.retrieveCard(cardId, userId);

    if (card) {
      await new Promise((resolve, reject) => {
        this.stripe.customers.deleteCard(
          card.stripeId,
          card.cardId,
          (err, data) => {
            if (err) reject(err);
            resolve(data);
          },
        );
      });
    }

    return !!card;
  }

  async chargeCard({
    cardId,
    userId,
    amount,
    description,
  }) {
    const card = await this.model.retrieveCard(cardId, userId);

    if (card) {
      await new Promise((resolve, reject) => {
        this.stripe.charges.create(
          {
            amount,
            currency: 'usd',
            source: card.sourceId,
            description,
          },
          (err, data) => {
            if (err) reject(err);
            resolve(data);
          },
        );
      });
    }

    return !!card;
  }

  async retrieveCards(userId) {
    const { stripeId } = await this.model.retrieveUserbyId(userId);

    return new Promise((resolve, reject) => {
      this.stripe.customers.listCards(
        stripeId,
        (err, data) => {
          if (err) reject(err);
          resolve(data);
        },
      );
    });
  }
};
