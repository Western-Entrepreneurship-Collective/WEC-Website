/**
 * Builds the WEC Executive Applications Google Form in one run.
 *
 * HOW TO RUN IT
 *   1. Sign in to the CLUB Google account.
 *   2. Go to script.google.com, New project, delete whatever is there.
 *   3. Paste this whole file in, press Save, then press Run.
 *   4. Approve the permissions it asks for (it only makes a Form and a Sheet).
 *   5. Open View, then Logs. It prints the Form link, the Sheet link, and the
 *      PRE-FILLED LINK. The pre-filled link is the one the website needs.
 *
 * It is safe to run twice: each run makes a brand new Form and Sheet.
 *
 * The pre-filled link goes into WEC_APPLY_GOOGLE_FORM_URL on Vercel. Full steps and
 * the setup check: docs/EXEC-APPLICATIONS-FORM.md. This builds the EXEC applications
 * Form only; the member sign up Form is docs/GOOGLE-FORM.md and is separate.
 */
function makeWecApplicationsForm() {
  var YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Other'];
  var ROLES = [
    'VP Content', 'VP Communications', 'VP Community',
    'Director of Admin', 'Event Experience Coordinator', 'Director of Logistics',
    'Director of Financial Operations', 'Speaker Acquisition Coordinator',
    'Outreach Coordinator', 'Director of Video', 'Email & Newsletter Coordinator',
    'Director of Engagement'
  ];

  var form = FormApp.create('WEC Executive Applications 2026-27');
  form.setDescription('By founders, for founders. Applications are submitted through the WEC website.');

  // Settings the website depends on. Any of these turned the other way makes
  // Google refuse every application, without saying why.
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setPublishingSummary(false);
  form.setAcceptingResponses(true);

  var items = {};
  function short(title, required) {
    var it = form.addTextItem().setTitle(title).setRequired(!!required);
    items[title] = it;
    return it;
  }
  function para(title, required) {
    var it = form.addParagraphTextItem().setTitle(title).setRequired(!!required);
    items[title] = it;
    return it;
  }
  function choice(title, options, required) {
    var it = form.addMultipleChoiceItem().setTitle(title).setChoiceValues(options).setRequired(!!required);
    items[title] = it;
    return it;
  }

  short('Full name', true);
  short('Western email', true);
  short('Personal email', true);
  short('Phone number', false);
  choice('Year of study', YEARS, true);
  short('Program / faculty', true);
  short('LinkedIn', false);
  short('Portfolio or website', false);
  short('Resume link', true);
  para('Short introduction', true);
  para('General question 1', true);
  para('General question 2', true);
  choice('Position applied for', ROLES, true);
  para('Role question 1', false);
  para('Role question 2', false);
  para('Role question 3', false);
  para('Role question 4', false);
  short('Role portfolio or video link', false);

  // The Sheet every application lands in.
  var sheet = SpreadsheetApp.create('WEC Executive Applications 2026-27 (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  // The pre-filled link. These words are placeholders: they are how the site
  // learns each question's hidden id. They are never submitted.
  var placeholders = {
    'Full name': 'NAME',
    'Western email': 'WESTERNEMAIL',
    'Personal email': 'PERSONALEMAIL',
    'Phone number': 'PHONE',
    'Year of study': '1st Year',
    'Program / faculty': 'PROGRAM',
    'LinkedIn': 'LINKEDIN',
    'Portfolio or website': 'PORTFOLIO',
    'Resume link': 'RESUME',
    'Short introduction': 'INTRO',
    'General question 1': 'GENERAL1',
    'General question 2': 'GENERAL2',
    'Position applied for': 'VP Content',
    'Role question 1': 'ROLE1',
    'Role question 2': 'ROLE2',
    'Role question 3': 'ROLE3',
    'Role question 4': 'ROLE4',
    'Role portfolio or video link': 'ROLELINK'
  };

  var response = form.createResponse();
  for (var title in placeholders) {
    // addTextItem and friends already hand back the typed item, so it carries
    // createResponse itself. Casting it again is what threw
    // "item.asTextItem is not a function".
    response.withItemResponse(items[title].createResponse(placeholders[title]));
  }

  Logger.log('FORM (edit it here):   ' + form.getEditUrl());
  Logger.log('FORM (public link):    ' + form.getPublishedUrl());
  Logger.log('SHEET (applications):  ' + sheet.getUrl());
  Logger.log('PRE-FILLED LINK, this is the one the website needs:');
  Logger.log(response.toPrefilledUrl());
}
