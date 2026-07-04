const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

test('mockup API uses backend mode by default for team and user flows', () => {
  const context = {
    console,
    localStorage: createLocalStorage(),
    window: {},
    XMLHttpRequest: class {
      constructor() {
        this.status = 200;
        this.responseText = '';
        this.headers = {};
      }

      open(method, url) {
        this.method = method;
        this.url = url;
      }

      setRequestHeader(name, value) {
        this.headers[name] = value;
      }

      send(payload) {
        this.responseText = JSON.stringify({
          data: [
            {
              id: 'team-1',
              name: 'U17 Elite',
              ageGroup: 'U17',
              leadCoach: 'Ana Costa',
              leadCoachEmail: 'ana@vantageiq.club',
              playerCount: 1
            }
          ]
        });
        this.status = 200;
      }
    }
  };

  context.window = context;
  context.global = context;
  context.globalThis = context;

  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'mockup-api-client.js' });

  const teams = context.window.MockupApi.listTeams();
  assert.equal(teams.length, 1);
  assert.equal(teams[0].name, 'U17 Elite');
});
