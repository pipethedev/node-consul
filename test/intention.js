"use strict";

const should = require("should");

const helper = require("./helper");

describe("Intention", function () {
  helper.setup(this);

  describe("create", function () {
    it("should work", async function () {
      this.nock
        .post("/v1/connect/intentions", {
          SourceName: "web",
          DestinationName: "db",
          Action: "allow",
        })
        .reply(200, { ID: "123" });

      const data = await this.consul.intention.create({
        sourcename: "web",
        destinationname: "db",
        action: "allow",
      });
      should(data).eql({ ID: "123" });
    });

    it("should work with all options", async function () {
      this.nock
        .post("/v1/connect/intentions", {
          SourceName: "web",
          DestinationName: "db",
          Action: "deny",
          Description: "Block web from db",
          SourceType: "consul",
          Meta: { key: "value" },
          Precedence: 9,
        })
        .reply(200, { ID: "123" });

      const data = await this.consul.intention.create({
        sourcename: "web",
        destinationname: "db",
        action: "deny",
        description: "Block web from db",
        sourcetype: "consul",
        meta: { key: "value" },
        precedence: 9,
      });
      should(data).eql({ ID: "123" });
    });

    it("should require sourcename", async function () {
      try {
        await this.consul.intention.create({
          destinationname: "db",
          action: "allow",
        });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.create: sourcename required",
        );
        should(err).have.property("isValidation", true);
      }
    });

    it("should require destinationname", async function () {
      try {
        await this.consul.intention.create({
          sourcename: "web",
          action: "allow",
        });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.create: destinationname required",
        );
        should(err).have.property("isValidation", true);
      }
    });

    it("should require action", async function () {
      try {
        await this.consul.intention.create({
          sourcename: "web",
          destinationname: "db",
        });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.create: action required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });

  describe("list", function () {
    it("should work", async function () {
      this.nock.get("/v1/connect/intentions").reply(200, [{ ID: "123" }]);

      const data = await this.consul.intention.list();
      should(data).eql([{ ID: "123" }]);
    });

    it("should work with options", async function () {
      this.nock
        .get("/v1/connect/intentions?dc=dc1")
        .reply(200, [{ ID: "123" }]);

      const data = await this.consul.intention.list({ dc: "dc1" });
      should(data).eql([{ ID: "123" }]);
    });
  });

  describe("get", function () {
    it("should work", async function () {
      this.nock.get("/v1/connect/intentions/123").reply(200, [{ ID: "123" }]);

      const data = await this.consul.intention.get({ id: "123" });
      should(data).eql({ ID: "123" });
    });

    it("should work with string ID", async function () {
      this.nock.get("/v1/connect/intentions/123").reply(200, []);

      const data = await this.consul.intention.get("123");
      should.not.exist(data);
    });

    it("should require ID", async function () {
      try {
        await this.consul.intention.get({});
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.get: id required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });

  describe("update", function () {
    it("should work", async function () {
      this.nock
        .put("/v1/connect/intentions/123", {
          SourceName: "web",
          DestinationName: "db",
          Action: "deny",
        })
        .reply(200);

      await this.consul.intention.update({
        id: "123",
        sourcename: "web",
        destinationname: "db",
        action: "deny",
      });
    });

    it("should work with all options", async function () {
      this.nock
        .put("/v1/connect/intentions/123", {
          SourceName: "web",
          DestinationName: "db",
          Action: "allow",
          Description: "Allow web to db",
          SourceType: "consul",
          Meta: { key: "value" },
          Precedence: 9,
        })
        .reply(200);

      await this.consul.intention.update({
        id: "123",
        sourcename: "web",
        destinationname: "db",
        action: "allow",
        description: "Allow web to db",
        sourcetype: "consul",
        meta: { key: "value" },
        precedence: 9,
      });
    });

    it("should require ID", async function () {
      try {
        await this.consul.intention.update({
          sourcename: "web",
          destinationname: "db",
          action: "allow",
        });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.update: id required",
        );
        should(err).have.property("isValidation", true);
      }
    });

    it("should require sourcename", async function () {
      try {
        await this.consul.intention.update({
          id: "123",
          destinationname: "db",
          action: "allow",
        });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.update: sourcename required",
        );
        should(err).have.property("isValidation", true);
      }
    });

    it("should require destinationname", async function () {
      try {
        await this.consul.intention.update({
          id: "123",
          sourcename: "web",
          action: "allow",
        });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.update: destinationname required",
        );
        should(err).have.property("isValidation", true);
      }
    });

    it("should require action", async function () {
      try {
        await this.consul.intention.update({
          id: "123",
          sourcename: "web",
          destinationname: "db",
        });
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.update: action required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });

  describe("destroy", function () {
    it("should work", async function () {
      this.nock.delete("/v1/connect/intentions/123").reply(200);

      await this.consul.intention.destroy({ id: "123" });
    });

    it("should work with string ID", async function () {
      this.nock.delete("/v1/connect/intentions/123").reply(200);

      await this.consul.intention.destroy("123");
    });

    it("should work using delete alias", async function () {
      this.nock.delete("/v1/connect/intentions/123").reply(200);

      await this.consul.intention.delete({ id: "123" });
    });

    it("should require ID", async function () {
      try {
        await this.consul.intention.destroy({});
        should.ok(false);
      } catch (err) {
        should(err).have.property(
          "message",
          "consul: intention.destroy: id required",
        );
        should(err).have.property("isValidation", true);
      }
    });
  });
});
