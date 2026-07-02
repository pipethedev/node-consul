"use strict";

const should = require("should");

const helper = require("./helper");

describe("Config", function () {
  helper.setup(this);

  describe("list", function () {
    it("should work", async function () {
      this.nock.get("/v1/config/service-resolver").reply(200, [
        {
          Kind: "service-resolver",
          Name: "salary-index-ng",
        },
      ]);

      const data = await this.consul.config.list("service-resolver");
      should(data).eql([
        {
          Kind: "service-resolver",
          Name: "salary-index-ng",
        },
      ]);
    });

    it("should work with options", async function () {
      this.nock.get("/v1/config/service-resolver?dc=dc1").reply(200, []);

      const data = await this.consul.config.list({
        kind: "service-resolver",
        dc: "dc1",
      });
      should(data).eql([]);
    });

    it("should require kind", async function () {
      try {
        await this.consul.config.list({});
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: config.list: kind required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });

  describe("get", function () {
    it("should work", async function () {
      this.nock.get("/v1/config/service-resolver/salary-index-ng").reply(200, {
        Kind: "service-resolver",
        Name: "salary-index-ng",
        Redirect: {
          Service: "6a3ea78d3d66fd3ab1dbbb12",
        },
      });

      const data = await this.consul.config.get({
        kind: "service-resolver",
        name: "salary-index-ng",
      });
      should(data).eql({
        Kind: "service-resolver",
        Name: "salary-index-ng",
        Redirect: {
          Service: "6a3ea78d3d66fd3ab1dbbb12",
        },
      });
    });

    it("should require kind", async function () {
      try {
        await this.consul.config.get({ name: "salary-index-ng" });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: config.get: kind required",
        );
        should(err).have.property("isValidation", true);
      }
    });

    it("should require name", async function () {
      try {
        await this.consul.config.get({ kind: "service-resolver" });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: config.get: name required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });

  describe("set", function () {
    it("should work", async function () {
      const entry = {
        Kind: "service-resolver",
        Name: "salary-index-ng",
        Redirect: {
          Service: "6a3ea78d3d66fd3ab1dbbb12",
        },
      };

      this.nock
        .put("/v1/config", entry)
        .matchHeader("x-consul-token", "token")
        .reply(200, true);

      const data = await this.consul.config.set(entry, { token: "token" });
      should(data).eql(true);
    });

    it("should require entry", async function () {
      try {
        await this.consul.config.set();
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: config.set: entry required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });

  describe("destroy", function () {
    it("should work", async function () {
      this.nock
        .delete("/v1/config/service-resolver/salary-index-ng")
        .reply(200, true);

      const data = await this.consul.config.destroy({
        kind: "service-resolver",
        name: "salary-index-ng",
      });
      should(data).eql(true);
    });

    it("should alias delete", async function () {
      this.nock
        .delete("/v1/config/service-resolver/salary-index-ng")
        .reply(200, true);

      const data = await this.consul.config.delete({
        kind: "service-resolver",
        name: "salary-index-ng",
      });
      should(data).eql(true);
    });

    it("should require kind", async function () {
      try {
        await this.consul.config.destroy({ name: "salary-index-ng" });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: config.destroy: kind required",
        );
        should(err).have.property("isValidation", true);
      }
    });

    it("should require name", async function () {
      try {
        await this.consul.config.destroy({ kind: "service-resolver" });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: config.destroy: name required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });
});
