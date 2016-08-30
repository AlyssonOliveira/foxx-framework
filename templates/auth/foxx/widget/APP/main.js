'use strict';
const db = require('@arangodb').db;
const joi = require('joi');
const createAuth = require('@arangodb/foxx/auth');
const createRouter = require('@arangodb/foxx/router');
const sessionsMiddleware = require('@arangodb/foxx/sessions');
const queues = require('@arangodb/foxx/queues');
const crypt = require('@arangodb/crypto');

const request = require('@arangodb/request');
const _ = require('underscore');
const auth = createAuth();
const router = createRouter();
const users = db._collection('users');
const organisations = db._collection('organisations');
const each = require('underscore').each;
const queue = queues.create('mailer');

const sessions = sessionsMiddleware({
  storage: 'sessions',
  transport: 'cookie'
});
module.context.use(sessions);
module.context.use(router);


var fields = []
var schema = {}

var loadFields = function() {
  
  // r: new row; c: classname; n: name/id; t: type; j: joi validation; l: label; d: data list
  fields = [
    { r: true,  c:"uk-width-1-1", n:"company", t:"string", j: joi.string().required(), l:"Société !!" },
    { r: true,  c:"uk-width-1-1", n:"fn", t:"string", j: joi.string().required(), l:"Nom" },
    { r: true,  c:"uk-width-1-1", n:"ln", t:"string", j: joi.string().required(), l:"Prénom" },
    { r: true,  c:"uk-width-1-1", n:"username", t:"email", j: joi.string().required(), l:"Email" },
    { r: true,  c:"uk-width-1-1", n:"password", t:"password", j: joi.string().min(8).max(32).required(), l:"Mot de passe" },
    { r: true,  c:"uk-width-1-1", n:"password_confirmation", t:"confirm", j: joi.string().required(), l:"Confirmation du mot de passe" }
  ]

  schema = {}
  each(fields, function(f) {
    schema[f.n] = f.j
  })
}

loadFields()

router.get('/check_form', function (req, res) {
  var errors = []
  var json = {}
  try {
    errors = joi.validate(JSON.parse(req.queryParams.data), schema, { abortEarly: false }).error.details
  } catch(e) { }

  json = JSON.parse(req.queryParams.data)
  if(json.password != json.password_confirmation) {
    errors.push({ "path": "password_confirmation", "message": "La confirmation du mot de passe ne correspond pas!"})
  }

  res.send({errors: errors});
})
.description('Check the form for live validation');

router.get('/fields', function (req, res) {
  loadFields()
  res.send({ fields: fields });
})
.description('Get all fields to build form');

// GET whoami
router.get('/whoami', function (req, res) {
  try {
    const user = users.document(req.session.uid);
    res.send({username: user.username, role: user.role, a: user.a});
  } catch (e) {
    
    res.send({username: null});
  }
})
.description('Returns the currently active username.');

// POST login
router.post('/login', function (req, res) {
  // This may return a user object or null
  const user = users.firstExample({
    username: req.body.username,
    a: true
  });
  const valid = auth.verify(
    user ? user.authData : {},
    req.body.password
  );
  // Log the user in
  if(valid) {
    req.session.uid = user._key;
    var ret = req.sessionStorage.save(req.session);
  }
  res.send({success: valid, uid: req.session});
})
.body(joi.object({
  username: joi.string().required(),
  password: joi.string().required()
}).required(), 'Credentials')
.description('Logs a registered user in.');

// POST logout
router.post('/logout', function (req, res) {
  if (req.session.uid) {
    req.session.uid = null;
    req.sessionStorage.save(req.session);
  }
  res.send({success: true});
})
.description('Logs the current user out.');

// POST signup
router.post('/signup', function (req, res) {
  const user = req.body;
  const uuid = crypt.genRandomAlphaNumbers(40);
    
  try {
    // Create an authentication hash
    user.authData = auth.create(user.password);
    delete user.password;
    delete user.password_confirmation;
    
    // Create an organisation
    let organisation = { n: user.company }
    const meta_org = organisations.save(organisation)
    Object.assign(organisation, meta_org);

    user.organisation_id = org._key;
    user.email_code = uuid;
    user.role = "provisoire";
    delete user.company;
    
    const meta = users.save(user);    
    Object.assign(user, meta);
  } catch (e) {
    res.throw('bad request', 'Username already taken', e);
  }
  // Log the user in
  queue.push(
    {mount: '/auth', name: 'send-mail'},
    {to: user.username, uuid: uuid}
  );
  req.session.uid = user._key;
  req.sessionStorage.save(req.session);
  res.send({success: true});
})
.body(joi.object(schema), 'Credentials')
.description('Creates a new user and logs them in.');

router.post('/confirm', function (req, res) {
  const user = users.firstExample({
    email_code: req.body.uuid
  });
  if(user) {
    user.a = true;
    delete user.email_code;
    users.update(user._id, user);
      
  }
  res.send({success: true});
})
.body(joi.object({
  uuid: joi.string().required(),
}).required(), 'UUID')
.description('Check email code');

