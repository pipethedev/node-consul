const errors = require("./errors");
const utils = require("./utils");

class Intention {
  constructor(consul) {
    this.consul = consul;
  }

  /**
   * Lists all intentions
   */
  async list(opts) {
    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "intention.list",
      path: "/connect/intentions",
      query: {},
    };

    utils.options(req, opts);

    return await this.consul._get(req, utils.body);
  }

  /**
   * Creates a new intention
   */
  async create(opts) {
    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "intention.create",
      path: "/connect/intentions",
      query: {},
      type: "json",
      body: {},
    };

    if (!opts.sourcename) {
      throw this.consul._err(errors.Validation("sourcename required"), req);
    }
    if (!opts.destinationname) {
      throw this.consul._err(
        errors.Validation("destinationname required"),
        req,
      );
    }
    if (!opts.action) {
      throw this.consul._err(errors.Validation("action required"), req);
    }

    req.body.SourceName = opts.sourcename;
    req.body.DestinationName = opts.destinationname;
    req.body.Action = opts.action;

    if (opts.description) req.body.Description = opts.description;
    if (opts.sourcetype) req.body.SourceType = opts.sourcetype;
    if (opts.meta) req.body.Meta = opts.meta;
    if (typeof opts.precedence === "number") {
      req.body.Precedence = opts.precedence;
    }
    if (opts.permissions) req.body.Permissions = opts.permissions;

    utils.options(req, opts);

    return await this.consul._post(req, utils.body);
  }

  /**
   * Gets a given intention
   */
  async get(opts) {
    if (typeof opts === "string") {
      opts = { id: opts };
    }

    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "intention.get",
      path: "/connect/intentions/{id}",
      params: { id: opts.id },
      query: {},
    };

    if (!opts.id) {
      throw this.consul._err(errors.Validation("id required"), req);
    }

    utils.options(req, opts);

    return await this.consul._get(req, utils.bodyItem);
  }

  /**
   * Updates an existing intention
   */
  async update(opts) {
    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "intention.update",
      path: "/connect/intentions/{id}",
      params: { id: opts.id },
      query: {},
      type: "json",
      body: {},
    };

    if (!opts.id) {
      throw this.consul._err(errors.Validation("id required"), req);
    }
    if (!opts.sourcename) {
      throw this.consul._err(errors.Validation("sourcename required"), req);
    }
    if (!opts.destinationname) {
      throw this.consul._err(
        errors.Validation("destinationname required"),
        req,
      );
    }
    if (!opts.action) {
      throw this.consul._err(errors.Validation("action required"), req);
    }

    req.body.SourceName = opts.sourcename;
    req.body.DestinationName = opts.destinationname;
    req.body.Action = opts.action;

    if (opts.description) req.body.Description = opts.description;
    if (opts.sourcetype) req.body.SourceType = opts.sourcetype;
    if (opts.meta) req.body.Meta = opts.meta;
    if (typeof opts.precedence === "number") {
      req.body.Precedence = opts.precedence;
    }
    if (opts.permissions) req.body.Permissions = opts.permissions;

    utils.options(req, opts);

    return await this.consul._put(req, utils.empty);
  }

  /**
   * Deletes a given intention
   */
  async destroy(opts) {
    if (typeof opts === "string") {
      opts = { id: opts };
    }

    opts = utils.normalizeKeys(opts);
    opts = utils.defaults(opts, this.consul._defaults);

    const req = {
      name: "intention.destroy",
      path: "/connect/intentions/{id}",
      params: { id: opts.id },
      query: {},
    };

    if (!opts.id) {
      throw this.consul._err(errors.Validation("id required"), req);
    }

    utils.options(req, opts);

    return await this.consul._delete(req, utils.empty);
  }

  delete() {
    return this.destroy.apply(this, arguments);
  }
}

exports.Intention = Intention;
