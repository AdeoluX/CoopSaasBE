const app = require('../app'); // Link to your server file
const supertest = require('supertest');
const request = supertest(app);
const { generateToken } = require('../src/utils/tokenManagement');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker')
const newTimeout = 1000000
describe('Authentication Tests', () => {
    jest.setTimeout(newTimeout)
    let email; 
    let password;
    let user;
    beforeAll(async () => {
        jest.setTimeout(newTimeout);
        email = 'juwontayo@gmail.com'
        password = faker.internet.password()
        mongoose.connect(
            `mongodb+srv://juwontayo:${process.env.MONGO_PASSWORD}@cluster0.nmvkxa9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,
            function () {
                /* Drop the DB */
                mongoose.connection.db.dropDatabase();
            }
        );
    });

    test('should sign up', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/sign-up')
            .set('Accept', 'application/json')
            // .set(`Authorization`, `Bearer ${token.access_token}`)
            .send({
                email: faker.internet.email(),
                password: password,
                confirmPassword: password,
                phone: faker.phone.number(),
                firstname: faker.person.firstName(),
                lastname: faker.person.lastName()
            });
            user = response.body.data
            expect(response.status).toBe(httpStatus.OK)
    });

    test('should get the user', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .get('/api/v1/user/me')
            .set('Accept', 'application/json')
            .set(`Authorization`, `Bearer ${user.token.access_token}`)
            .send();
            console.log(response.body.data, 'HEERRREEE')
            user = response.body.data
            expect(response.status).toBe(httpStatus.OK)
    });
    
});

// /get-my-prayers /verify-email
