module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("account_tokens", ["user_id", "purpose", "created_at"], {
      name: "account_tokens_rate_limit_idx"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("account_tokens", "account_tokens_rate_limit_idx");
  }
};

