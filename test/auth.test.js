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
    let otp, otp_id;
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
                email,
                password: password,
                confirmPassword: password,
                phone: faker.phone.number(),
                firstname: faker.person.firstName(),
                lastname: faker.person.lastName()
            });
            console.log(response.body.data.otp.otpInstance._id, 'HEERRREEE')
            otp = response.body.data.otp.otp 
            otp_id = response.body.data.otp.otpInstance._id
            expect(response.status).toBe(httpStatus.OK)
    });
    test('should fail sign up', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/sign-up')
            .set('Accept', 'application/json')
            .send({
                email,
                password: faker.internet.password(),
                confirmPassword: faker.internet.password(),
                phone: faker.phone.number(),
                firstname: faker.person.firstName(),
                lastname: faker.person.lastName()
            });
        console.log(response.body)
        expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });
    test('should verify email', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/verify-email')
            .set('Accept', 'application/json')
            .send({
                otp,
                id: otp_id,
            });
        console.log(response.body)
        expect(response.status).toBe(httpStatus.OK);
    });

    test('should fail to verify email', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/verify-email')
            .set('Accept', 'application/json')
            .send({
                otp,
                id: '65e5e60b5437d6dbf1167c92',
            });
        console.log(response.body)
        expect(response.status).toBe(httpStatus.BAD_REQUEST);
        expect(response.body.message).toBe('Invalid Otp')
    });

    test('should fail to verify email', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/verify-email')
            .set('Accept', 'application/json')
            .send({
                otp,
            });
        console.log(response.body)
        expect(response.status).toBe(httpStatus.BAD_REQUEST);
        expect(response.body.message).toBe('"id" is required');
    });
    test('should login', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/login')
            .set('Accept', 'application/json')
            .send({
                email,
                password,
            });
        expect(response.status).toBe(httpStatus.OK);
        expect(response.body.data.message).toBe('Proceed to 2fa authentication.');
    });

    test('should 2fa authenticate', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/authenticate-2fa')
            .set('Accept', 'application/json')
            .send({
                otp,
                email
            });
        console.log(response.body)
        expect(response.status).toBe(httpStatus.OK);
        expect(response.body.message).toBe("Success");
    });

    test('should fail to login', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/login')
            .set('Accept', 'application/json')
            .send({
                email: '',
                password: '',
            });
        console.log(response.body)
        expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    test('should fail to login', async () => {
        jest.setTimeout(newTimeout)
        const response = await request
            .post('/api/v1/auth/login')
            .set('Accept', 'application/json')
            .send({
                email: '',
                password: '',
            });
        console.log(response.body)
        expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    
});

// /get-my-prayers /verify-email
