const papi = require("papi");

const Acl = require("./acl").Acl;
const Agent = require("./agent").Agent;
const Catalog = require("./catalog").Catalog;
const Config = require("./config").Config;
const Event = require("./event").Event;
const Health = require("./health").Health;
const Intention = require("./intention").Intention;
const Kv = require("./kv").Kv;
const Query = require("./query").Query;
const Resolver = require("./resolver").Resolver;
const Session = require("./session").Session;
const Status = require("./status").Status;
const Watch = require("./watch").Watch;
const Transaction = require("./transaction").Transaction;
const utils = require("./utils");

class Consul extends papi.Client {
  constructor(opts) {
    opts = utils.defaults({}, opts);

    if (!opts.baseUrl) {
      opts.baseUrl =
        (opts.secure ? "https:" : "http:") +
        "//" +
        (opts.host || "127.0.0.1") +
        ":" +
        (opts.port || 8500) +
        "/v1";
    }
    opts.name = "consul";
    opts.type = "json";

    let agent;
    if (!opts.agent) {
      agent = utils.getAgent(opts.baseUrl);
      if (agent) {
        opts.agent = agent;
      }
    }

    let defaults;
    if (opts.defaults) {
      defaults = utils.defaultCommonOptions(opts.defaults);
    }
    delete opts.defaults;

    super(opts);

    if (defaults) this._defaults = defaults;

    this.acl = new Consul.Acl(this);
    this.agent = new Consul.Agent(this);
    this.catalog = new Consul.Catalog(this);
    this.config = new Consul.Config(this);
    this.event = new Consul.Event(this);
    this.health = new Consul.Health(this);
    this.intention = new Consul.Intention(this);
    this.kv = new Consul.Kv(this);
    this.query = new Consul.Query(this);
    this.session = new Consul.Session(this);
    this.status = new Consul.Status(this);
    this.transaction = new Consul.Transaction(this);
  }

  destroy() {
    if (this._opts.agent && this._opts.agent.destroy) {
      this._opts.agent.destroy();
    }
  }

  watch(opts) {
    return new Consul.Watch(this, opts);
  }

  resolver(config) {
    return new Consul.Resolver(this, config);
  }

  static parseQueryMeta(res) {
    return utils.parseQueryMeta(res);
  }
}

Consul.Acl = Acl;
Consul.Agent = Agent;
Consul.Catalog = Catalog;
Consul.Config = Config;
Consul.Event = Event;
Consul.Health = Health;
Consul.Intention = Intention;
Consul.Kv = Kv;
Consul.Query = Query;
Consul.Resolver = Resolver;
Consul.Session = Session;
Consul.Status = Status;
Consul.Transaction = Transaction;
Consul.Watch = Watch;

exports.Consul = Consul;
