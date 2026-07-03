import { Before } from '@cucumber/cucumber';
import { BddWorld } from './world';

Before(function (this: BddWorld) {
  this.users.clear();
  this.actorRole = null;
  this.activeToken = null;
  this.tokenExpired = false;
  this.resetResponse();
});
