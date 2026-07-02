const errors = require("./errors");
const utils = require("./utils");

class Config {
  constructor(consul) {
    this.consul = consul;
  }

  /**
   * Lists config entries for a kind
   */
  async list(opts) {
    if (typeof opts === "string") {
      opts = { kind: opts };
    }

    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "config.list",
      path: "/config/{kind}",
      params: { kind: opts.kind },
      query: {},
    };

    if (!opts.kind) {
      throw this.consul._err(errors.Validation("kind required"), req);
    }

    utils.options(req, opts);

    return await this.consul._get(req, utils.body);
  }

  /**
   * Gets a config entry
   */
  async get(opts) {
    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "config.get",
      path: "/config/{kind}/{name}",
      params: { kind: opts.kind, name: opts.name },
      query: {},
    };

    if (!opts.kind) {
      throw this.consul._err(errors.Validation("kind required"), req);
    }
    if (!opts.name) {
      throw this.consul._err(errors.Validation("name required"), req);
    }

    utils.options(req, opts);

    return await this.consul._get(req, utils.body);
  }

  /**
   * Creates or updates a config entry
   */
  async set(entry, opts) {
    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "config.set",
      path: "/config",
      query: {},
      type: "json",
      body: entry,
    };

    if (!entry) {
      throw this.consul._err(errors.Validation("entry required"), req);
    }

    utils.options(req, opts);

    return await this.consul._put(req, utils.body);
  }

  /**
   * Deletes a config entry
   */
  async destroy(opts) {
    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "config.destroy",
      path: "/config/{kind}/{name}",
      params: { kind: opts.kind, name: opts.name },
      query: {},
    };

    if (!opts.kind) {
      throw this.consul._err(errors.Validation("kind required"), req);
    }
    if (!opts.name) {
      throw this.consul._err(errors.Validation("name required"), req);
    }

    utils.options(req, opts);

    return await this.consul._delete(req, utils.body);
  }

  delete() {
    return this.destroy.apply(this, arguments);
  }
}

exports.Config = Config;
