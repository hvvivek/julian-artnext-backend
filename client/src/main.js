// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './components/App'

Vue.config.productionTip = false

import Router from 'vue-router'

import auth from './modules/auth'

import UserExperiments from './components/UserExperiments'
import Experiment from './components/Experiment'
import CreateExperiment from './components/CreateExperiment'
import Participant from './components/Participant'
import Login from './components/Login'
import Register from './components/Register'
import EditUser from './components/EditUser'

Vue.use(Router)

let router = new Router({
  routes: [
    {
      path: '/',
      redirect: to => {
        if (auth.user.authenticated) {
          return '/experiments'
        } else {
          return '/login'
        }
      }
    },
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/register',
      name: 'register',
      component: Register
    },
    {
      path: '/edit-user',
      name: 'editUser',
      component: EditUser
    },
    {
      path: '/experiments',
      name: 'expriments',
      component: UserExperiments
    },
    {
      path: '/create-experiment',
      name: 'createExpriment',
      component: CreateExperiment
    },
    {
      path: '/experiment/:experimentId',
      name: 'expriment',
      component: Experiment
    },
    {
      path: '/participant/:participateId',
      name: 'participant',
      component: Participant
    }
  ]
})

auth
  .restoreLastUser()
  .then(() => {
    new Vue({
      el: '#app',
      router,
      template: '<App/>',
      components: {App}
    })
  })
