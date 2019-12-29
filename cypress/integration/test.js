let font = 'Sunflower, sans-serif';
let user = 'twitter';

Cypress.Screenshot.defaults({
    screenshotOnRunFailure: false
});

describe('it loads the site', () => {
    it('visits index', () => {
        cy.visit('/');

        cy.get('h1')
            .should('have.text', 'Twitter Grade Stats')
            .and('have.css', 'font-family', font);

        cy.get('#username')
            .should('have.value', '')
            .and('have.attr', 'placeholder', 'Twitter handle');

        cy.get('[type="submit"]')
            .should('have.value', 'Get Grades');
    });

    it('has the correct value after typing', () => {
        cy.get('#username')
            .type(user)
            .should('have.value', user);
    });

    it('submits the form correctly', () => {
        cy.get('[type="submit"]')
            .click();
    });
});

describe('it loads stats', () => {
    it('visits /users/ and has appropriate parts', () => {
        cy.url()
            .should('contain', 'user')
            .and('contain', 'username')
            .and('contain', user);

        cy.get('#user-graph')
            .should('be.visible');

        cy.contains('Some Quick Stats');
    });

    it('has a dynamic title', () => {
        cy.get('h1')
            .should('contain', user)
            .and('contain', 'Tweets');
    });

    it('has the 5th grader comparison', () => {
        cy.get('#fifth-grade-boolean')
            .contains(/^(yes|no)/gim);
    });

    it('has a working tweet table', () => {
        cy.get('#tweet-table')
            .should('not.be.visible');

        cy.get('#tweet-table-toggle')
            .should('be.visible')
            .click();

        cy.get('#tweet-table')
            .should('be.visible')
            .and('have.css', 'border-collapse', 'collapse');

        cy.get('th')
            .should('have.length', 2)
            .and('contain', 'Tweet')
            .and('contain', 'Grade');
    });
});

describe('it 404s on undefined pages', () => {
    it('404s on defined pages', () => {
        cy.visit('/undefined', {
            failOnStatusCode: false
        });

        cy.url()
            .should('contain', 'undefined');
    });
});
