const routeAuth = require('../modules/isAuth.js');
const models = require('../models');
// const mail = require('../modules/emailClient');

function newNode(imageIndex, left, right) {
  const node = {};
  node.imageIndex = imageIndex;
  node.left = left;
  node.right = right;
  return node;
}

module.exports = (app) => {

  // [GET] Display the UI to send invites.
  app.get('/experiment/:id/invite', routeAuth.isAuth, (req, res) => {
    // TODO: Ensure user owns or is collaborator on the experiment.

    // Retrieve the experiment from the Database and render the UI.
    models.Experiment
      .findOne(
      { where: { id: req.params.id } })
      .then((experiment) => {
        res.render('experiment-invite', experiment.dataValues);
      })
      .catch(err => {
        res.render('error', err);
      });
  });

  // [POST] Invite form submission.
  app.post('/experiment/invite', routeAuth.isAuth, (req, res) => {
    // Ensure all required fields are set.
    if (!req.body.id) { res.render('error'); return null; }
    if (!req.body.type) { res.render('error'); return null; }
    if (!req.body.emails) { res.render('error'); return null; }
    if (req.body.type !== 'collaborate' && req.body.type !== 'participate') { res.render('error'); return null; }
    if (req.body.emails.length === 0) { res.render('error'); return null; }

    // TODO: Ensure user owns or is collaborator on the experiment.

    // Fetch the Experiment to send the invites for.
    models.Experiment
      .findOne({ where: { id: req.body.id } })
      .then((experiment) => {
        let emails = req.body.emails.split(',');
        emails.forEach((email) => {
          let type = req.body.type; // "collaborate", "participate"
          email = email.trim();
          models.Invite
            .create({ email, type })
            .then((invite) => {
              experiment.addInvite(invite);
              // send relevant invites to each.
              // mail.sendInvite(req.body.type, email.trim(), invite.dataValues.inviteId);
            })
            .catch(err => {
              res.render('error', err);
            });
        });
        res.redirect(301, '/dashboard');
      })
      .catch(err => {
        res.render('error', err);
      });

    return null;
  });

  // [GET] Accept invitation.
  app.get('/invites/:uuid', (req, res) => {
    // There are two types of invites, participate and collaborate.
    models.Invite
      .findOne({ where: { inviteId: req.params.uuid } })
      .then((invite) => {
        // If the invite is to collaborate
        if (invite.type === 'collaborate') {
          // ensure the user is logged in and accept the invitation.
          if (req.user) {
            models.Experiment
              .findOne({ where: { id: invite.ExperimentId } })
              .then(experiment => {
                experiment.addUser(req.user.id, { permission: 1 });
              })
              .then(() => {
                invite
                  .destroy()
                  .then(() => {
                    res.redirect(301, '/dashboard');
                  });
              });
          } else {
            res.render('login');
          }
        } else if (invite.type === 'participate') {
          // If the invite is to participate, load the experiment.
          models.Experiment
            .findOne({ where: { id: invite.ExperimentId } })
            .then(experiment => {
              res.render('experiment-run', experiment.dataValues);
            });
        } else {
          // Someone did something bad, grr!
          res.render('error');
        }
      });
  });

  // [POST] Handle Experiment Participation
  app.post('/invites/:uuid', (req, res) => {
    // Check ID
    models.Invite
      .findOne({ where: { inviteId: req.params.uuid } })
      .then((invite) => {
        // Grab Experiment Images
        models.Experiment
          .find({
            where: { id: invite.ExperimentId },
            include: [{ model: models.Image, as: 'Images' }],
          })
          .then((experiment) => {

            const imageUrls = experiment.Images.map(
              image => image.get({ plain: true }).url);

            // Phase 1
            // The User Just Started
            // Wants first 2
            if (req.body.start === true) {

              // Server Side Validation
              let userAge = (typeof parseInt(req.body.age, 10) === typeof 1) ? req.body.age : 0;
              userAge = (userAge > 0) ? userAge : 0;
              const userGender = (req.body.gender === 'male' ||
                req.body.gender === 'female' ||
                req.body.gender === 'other') ? req.body.gender : 'other';

              // Initialise Result Object
              models.Result
                .findOrCreate({
                  where: { inviteId: req.params.uuid },
                  defaults: {
                    age: userAge,
                    gender: userGender,
                    imageIndex: 1,
                    treeIndex: 0,
                    tree: [newNode(0, null, null)],
                    ExperimentId: invite.ExperimentId,
                  },
                })
                .then((result) => {
                  const state = result.get({ plain: true });
                  // Send the index of the image
                  // Along with url attached to index
                  const comparison = {
                    itemA: {
                      value: state.tree[state.treeIndex].imageIndex,
                      url: imageUrls[state.tree[state.treeIndex].imageIndex],
                    },
                    itemB: {
                      value: state.tree[state.treeIndex].imageIndex + 1,
                      url: imageUrls[state.tree[state.treeIndex].imageIndex + 1],
                    },
                  };

                  // Send Resulting Comparison
                  res.json(comparison);
                });
            }

            // Phase 2
            // The User Has Started
            // Wants Next Data
            if (typeof req.body.return !== typeof undefined) {
              // Initialise Result Object
              models.Result
                .findOne({ where: { inviteId: req.params.uuid } })
                .then((result) => {
                  const state = result.get({ plain: true });
                  const smaller = (req.body.return > state.tree[state.treeIndex].imageIndex);

                  // Chose The First Item
                  // Newest Item is Worse
                  if (smaller) {
                    // Traverse Tree
                    if (typeof state.tree[state.treeIndex].right === typeof 1) {
                      state.treeIndex = state.tree[state.treeIndex].right;
                    }

                    // Insert Node
                    else { //eslint-disable-line
                      state.tree[state.treeIndex].right = state.tree.length;
                      state.treeIndex = 0;
                      state.tree[state.tree.length] = newNode(state.imageIndex, null, null);
                      state.imageIndex += 1; //eslint-disable-line
                    }
                  } else { //eslint-disable-line
                    // Chose The Second Item
                    // Newest Item is Better

                    // Traverse Tree
                    if (typeof state.tree[state.treeIndex].left === typeof 1) { //eslint-disable-line
                      state.treeIndex = state.tree[state.treeIndex].left;
                    }

                    // Insert Node
                    else { //eslint-disable-line
                      state.tree[state.treeIndex].left = state.tree.length;
                      state.treeIndex = 0;
                      state.tree[state.tree.length] = newNode(state.imageIndex, null, null);
                      state.imageIndex += 1; //eslint-disable-line
                    }
                  }

                  // Update TREE
                  result
                    .update({ tree: state.tree })
                    .then(() => {
                      // End of Buffer Check
                      if (state.imageIndex === imageUrls.length) {
                        res.json({ done: true });
                        return null;
                      }

                      // Send Next Item
                      let comparison = {};
                      if (smaller) {
                        comparison = {
                          itemB: {
                            value: state.imageIndex,
                            url: imageUrls[state.imageIndex],
                          },
                          itemA: {
                            value: state.tree[state.treeIndex].imageIndex,
                            url: imageUrls[state.tree[state.treeIndex].imageIndex],
                          },
                        };
                      } else {
                        comparison = {
                          itemB: {
                            value: state.tree[state.treeIndex].imageIndex,
                            url: imageUrls[state.tree[state.treeIndex].imageIndex],
                          },
                          itemA: {
                            value: state.imageIndex,
                            url: imageUrls[state.imageIndex],
                          },
                        };
                      }
                      return res.json(comparison);
                    });
                }).catch(() => {
                  // User entered fake UUID
                  res.render('error');
                });
            }
          }).catch(() => {
            // This Experiment Does Not Exist
            res.render('error');
          });
      }).catch(() => {
        // User entered fake UUID
        res.render('error');
      });
  });

  // [GET] Finished Results
  app.get('/invites/:uuid/done', (req, res) => {
    // Convert to ranked array
    // Check ID
    models.Invite
      .findOne(
      { where: { inviteId: req.params.uuid }, })
      .then((invite) => {
        // Grab Experiment Images
        models.Experiment
          .findOne({
            where: { id: invite.ExperimentId },
            include: [{ model: models.Image, as: 'Images' }],
          })
          .then((experiment) => {
            // Get Image Buffer
            const items = experiment.Images.map((obj) => { //eslint-disable-line
              return obj.get({ plain: true }).url;
            });

            // Get The User's State
            models.Result
              .findOne({ where: { inviteId: req.params.uuid }, })
              .then((result) => {
                const state = result.get({ plain: true });

                // Perform Pre Order Search
                const ranks = [];
                function display(root) {
                  if (typeof state.tree[root] !== typeof undefined) {
                    display(state.tree[root].right);
                    ranks.push(items[state.tree[root].imageIndex]);
                    display(state.tree[root].left);
                  }
                }

                display(0);

                result
                  .update({ ranks: ranks })
                  .then(() => {
                    res.render('experiment-thankyou');
                  });
              });
          })
          .catch(() => {
            res.render('error');
          });
      });
  });
};
