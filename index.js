var express = require('express');
var app = express();
var bcrypt = require('bcrypt');
var http = require('http'), fs = require('fs');
var https = require('https');
var bodyParser = require('body-parser');
var session = require('cookie-session');
var mailer = require("nodemailer");
var path = require('path');
var escape = require("html-escape");

var pg = require('pg');

var salt = bcrypt.genSaltSync(10);

function authenticate_password(user, password) {
	//Code to retrieve the hash for the user
	//code .....

	// Load password hash from DB
	bcrypt.compare(password, hash, function(err, res) {
	    if (res === true){
	    	//successful password
	    	console.log("Password authentication successful")
	    }else{
	    	console.log("Password authentication failed")
	    }
	});
}


app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(session({keys:['annotator'], maxAge:14400000, rolling: true}));
app.use(bodyParser());

var annotateDir = path.join(__dirname, 'annotate')

//app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
  response.send("Root");
});

app.get('/login', function(req, response) {
	if (req.session.username && req.session.password != null) {
		console.log("Already logged in " + req.session.username)
		//response.redirect('/payer-annotate');
	}
	response.sendFile(path.join(annotateDir, 'login.html'));
});

app.get('/logout', function(req, response) {
	console.log("Logging out ", req.session.username);
	req.session = null;
	//response.send(path.join(annotateDir, 'login.html'));
	//response.redirect('/login');
	response.sendFile(path.join(annotateDir, 'login.html'));
});

app.get('/login-status', function(request, response) {
	if (request.session.username && request.session.password != null) {
		console.log("Already logged in " + request.session.username)
		response.send("Already logged in " + request.session.username)
	} else{
		response.send("You are currently not logged in.")
	}
});



/*app.get('/payer-annotate', function(request, response) {
	response.sendFile(path.join(annotateDir, 'payer-annotate.html'));
});*/

app.get('/create-user', function(request, response) {
	//response.redirect('./annotate/create-user.html');
	response.sendFile(path.join(annotateDir, 'create-user.html'));
});

//Verify a user account given a verification get request
app.get('/verify', function(request, response) {
	//console.log(request.query)
	//code to change verification to 1
	//
	var tstamp = request.query.hash 
	var email = request.query.email
	pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
		client.query("UPDATE user_passwords SET verif = '1' WHERE user_passwords.usr = $1 AND user_passwords.timestamp = $2 ;", [email, tstamp], function(err2, result){
			if (err) {
				console.error(err2);
				response.send("Error:" + err2);
			}
			else if (result.rowCount > 0) {
				//console.log(result);
				var appurl = request.protocol + '://' + request.get('host') + "/login";
				response.send("<p>Account " + request.query.email + " was verified</p><p></p><p> Return to " + '<a href="' + appurl + '">' + "the login page" + "</a></p>" );
			} else {
				response.send("<p>Problem Verifying the account</p><p></p><p>" + email + " " + tstamp + "</p>")
			}
			done();
		});
		

	});
	//Need to redirect to login page after this
});

app.post('/annotate/getannot', function(request, response){
	if (request.session.username && request.session.password != null) {
		pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
			if (err) {
				console.error(err)
				response.send("Error:" + err)
			}
			else{
				client.query("SELECT content from article_annotations where volid = $1;", [request.body.vol], function(err2, result){
					if (err2){
						response.send("Error:"+ err2)
					}
					else{
						response.send(result.rows[0])
					}
				});
			}
			done();
		});
	}
	else{
		response.send("Error:" + " user is not logged in ")
	}
});

app.post('/annotate/payer-annotate', function(request, response) {
	if (request.session.username && request.session.password != null) {
		pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
			if (err) {
				console.error(err)
				response.send("Error:" + err)
			}
			else{
				console.log(request.body.vol);
				//console.log(request.body.annot);
				console.log(request.body.page);
				client.query("SELECT volid from article_annotations where volid = $1;", [request.body.vol], function(err2, result){
					if (err2){
						response.send("Error:"+ err2)
					}
					else{
						if (result.rows.length > 0) {
							client.query("UPDATE article_annotations SET content = $1, annot_user = $2 WHERE volid = $3;", [request.body.annot, request.session.username, request.body.vol], function(err3, result){
								if (err3){
									response.send("Error:"+ err3)
								}
								else{
									console.log("Saved Entry by ", request.session.username);
									if (request.body.page == 'location') {
										client.query("UPDATE article_texts_location SET annotated = $1 WHERE id = $2;", [1, request.body.vol], function(err4, result){
											if (err4){
												response.send("Error:"+ err4)
											}
											else{
												response.send("Saving Successful on vol " + request.body.vol)
											}
										});
									}
									else if (request.body.page == 'payer'){
										client.query("UPDATE article_texts SET annotated = $1 WHERE id = $2;", [1, request.body.vol], function(err4, result){
											if (err4){
												response.send("Error:"+ err4)
											}
											else{
												response.send("Saving Successful on vol " + request.body.vol)
											}
										});
									}
									
								}
							});
						}
						else{
							client.query("INSERT INTO article_annotations (volid, content, annot_user) VALUES($1, $2, $3);;", [request.body.vol, request.body.annot, request.session.username], function(err3, result){
								if (err3){
									response.send("Error:"+ err3)
								}
								else{
									console.log("Saved Entry by ", request.session.username);
									if (request.body.page == 'payer'){
										client.query("UPDATE article_texts SET annotated = $1 WHERE id = $2;", [1, request.body.vol], function(err4, result){
											if (err4){
												response.send("Error:"+ err4)
											}
											else{
												response.send("Saving Successful on vol " + request.body.vol)
											}
										});
									}
									else if (request.body.page == 'location'){
										client.query("UPDATE article_texts_location SET annotated = $1 WHERE id = $2;", [1, request.body.vol], function(err4, result){
											if (err4){
												response.send("Error:"+ err4)
											}
											else{
												response.send("Saving Successful on vol " + request.body.vol)
											}
										});
									};
								}
							});
						}
					}
				});
			}
			done();
		});
	}
	else{
		response.send("Error:" + " user is not logged in ")
	}
});

app.get('/annotate/getpayertablerows', function(request, response){
	if (request.session.username && request.session.password != null) {
		pg.connect(process.env.DATABASE_URL, function(err, client, done) {
			if (err) {
				console.error(err)
				response.send("Error: Problem Connecting to DB")
				//response.send("Error:" + err)
			}
			else{
				client.query("SELECT key, names from payer_types;", function(err2, result){
					if (err2){
						response.send("Error: querying the DB");
					}
					else{
						response.send(result.rows)
					}
				});
			}
			done();
		});
	}
	else{
		response.send("Error: "+ "You are currently not logged in. Cannot get Table Rows")
	}
});

app.get('/annotate/getvoltablerows-payer', function(request, response){
	if (request.session.username && request.session.password != null) {
		pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
			if (err) {
				console.error(err)
				response.send("ERROR Connecting to DB")
				//response.send("Error:" + err)
			}
			else{
				client.query("SELECT id, title, annotated from article_texts;", function(err2, result){
					if (err2){
						response.send("Error querying the DB");
					}
					else{
						response.send(result.rows)
					}
				});
			}
			done();
		});
	}
	else{
		response.send("Error: "+ "You are currently not logged in. Cannot get Table Rows")
	}
});

app.get('/annotate/getvoltablerows-location', function(request, response){
	if (request.session.username && request.session.password != null) {
		pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
			if (err) {
				console.error(err)
				response.send("ERROR Connecting to DB")
				//response.send("Error:" + err)
			}
			else{
				client.query("SELECT id, title, annotated from article_texts_location;", function(err2, result){
					if (err2){
						response.send("Error querying the DB");
					}
					else{
						response.send(result.rows)
					}
				});
			}
			done();
		});
	}
	else{
		response.send("Error: "+ "You are currently not logged in. Cannot get Table Rows")
	}
});

app.post('/create-user', function(req, http_response) {
	//console.log(process.env.DATABASE_URL);
	//console.log(req.body.user)
	pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
		//var hash = bcrypt.hashSync(req.body.password, salt);
		client.query("SELECT usr from user_passwords WHERE user_passwords.usr = $1 and user_passwords.verif = '1';", [req.body.user], function(err, result){
			if (err) { 
				console.error(err);
				http_response.send("Error:" + err);
				 }
			else if (result.rows.length > 0) {
				console.log("Email Account is already registered " + result);
				http_response.json({message:'Account Already Exists'})
				//req.session.username = req.body.user;
				//req.session.password = hash;
				//response.redirect('/payer-annotate')
			}
			else{
				//Create Account from username, password
				if (req.body.user.length >= 7){
					mail['to'] = req.body.user
					var timestamp = bcrypt.hashSync(new Date().toISOString(), salt);
					var hash = bcrypt.hashSync(req.body.password, salt);
					var appurl = req.protocol + '://' + req.get('host');
					mail['html'] = "<body><div>Thank you for creating an account on this GeoAnnotate App.</div><p></p><p> Complete your account creation by following this link: " + appurl + "/verify?email=" + req.body.user + "&hash=" + timestamp + "&dummvar=14</p></body>"
					
					client.query("INSERT INTO user_passwords VALUES ($1, $2, '0', $3)", [req.body.user, hash, timestamp], function(err, result){
			        	if (err) { 
							console.error(err);
							http_response.send("Error:" + err);
							done();
						}else{
							if (typeof smtpTransport != undefined) {

								smtpTransport.sendMail(mail, function(error, response){
								    if(error){
								        console.log(error);
								        done();
								        http_response.send(error);
								    }else{
								        console.log("Message sent: " + response.message);
								        var hash = bcrypt.hashSync(req.body.password, salt);

								        http_response.send("Confirmation Email has been sent to " + req.body.user);
								        done();
								    	
								    }
								    smtpTransport.close();
								});
							}
							else{
								http_response.send("ERROR: There was an issue in starting the account creation mail server, check logs");
							}
						}
					});
				}else{
					console.log("Password is too short");
					response.json({message:'The password is too short. Please make the password at least 7 characters'});

				}
			}
		});
	});
});

app.get('/annotate/location-annotate', function(request, response) {
	if (request.session.username && request.session.password != null) {
		console.log(request.session.username + " navigating to location annotate page")
		response.sendFile(path.join(annotateDir, 'location-annotate.html'));
	}
	else{
		console.log("invalid credentials")
		response.send("<p>You are not logged in. You must log in before preceding.</p><p></p><p> Return to " + '<a href="' + '/login' + '">' + "the login page" + "</a></p>" );
	}
});

app.get('/annotate/payer-annotate', function(req, response) {
	console.log(req.body);
	if (req.session.username && req.session.password != null) {
		console.log(req.session.username + " navigating to entity-annotate page")
		response.sendFile(path.join(annotateDir, 'payer-annotate.html'));
	}
	else{
		console.log("invalid credentials")
		response.send("<p>You are not logged in. You must log in before preceding.</p><p></p><p> Return to " + '<a href="' + '/login' + '">' + "the login page" + "</a></p>" );
	}
});

app.post('/annotate/gettext', function(req, response) {
	if (req.session.username && req.session.password != null) {
		pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
			if (err){
				console.error(err)
			}
			else{
				var id = req.body.vol
				var page_type = req.body.page
				console.log(id, page_type)
				if (page_type == 'payer') {
					client.query("SELECT content from article_texts where id = $1;", [req.body.vol], function(err2, result){
						if (err2){
							console.error(err2)
							done();
						}
						else{
							response.send(result.rows[0]['content']);
							done();
						}
					});
				}
				else if (page_type == 'location'){
					client.query("SELECT content from article_texts_location where id = $1;", [req.body.vol], function(err2, result){
						if (err2){
							console.error(err2)
							done();
						}
						else{
							response.send(result.rows[0]['content']);
							done();
						}
					});
				}
			}
		});
	}
	else{
		console.log("Not Logged in");
		response.send("Not logged in");

	}
});

app.post('/annotate/user-login', function(req, response) {
	//console.log(req.body)
	//console.log(req.session)
	if (req.session.username && req.session.password != null) {
		console.log("Already logged in.")
		//response.redirect('/payer-annotate');
	}
	else{
		pg.connect(process.env.DATABASE_URL+"?ssl=true", function(err, client, done) {
			var hash = bcrypt.hashSync(req.body.pass, salt);
			//console.log(hash)
			//console.log("Connection Successful");
			client.query("SELECT * from user_passwords where user_passwords.usr = $1 and user_passwords.verif = '1';", [req.body.user], function(err, result){
				if (err) {
					console.error(err);
					response.send('#Error# - Application Error consult logs')
				}
				else if (result.rows.length > 0) {
					//console.log(result.rows);
					bcrypt.compare(req.body.pass, result.rows[0].pass, function(err, res) {
						if (err){
							console.error(err);
						}
						else if (res == true) {
    						req.session.username = req.body.user;
							req.session.password = hash;
							response.send('Successfully logged in as ' + req.session.username + ". Select an annotation page to navigate to below")
    					}
    					else {
    						response.send('Password is incorrect')
    					}
					});
				}
				else {
					console.log(req.body.user, "user doesn't exist");
					response.send('Username does not exist or account not verified')
				}
			});
			done();
		});
		//check_pass = "SELECT * from user_passwords WHERE user_passwords.usr = $1;", [req.session.user]
	}
	return;
});


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


// Use Smtp Protocol to send Email
var smtpTransport = mailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: "GeoAnnotateApp@gmail.com",
        pass: "$ANNOTATE_PASS"
    }
});

var mail = {
    from: "GeoAnnotate App <GeoAnnotateApp@gmail.com>",
    to: "to@gmail.com",
    subject: "GeoAnnotate Account Verification",
    text: "Node.js New world for me",
    html: "<b>Node.js New world for me</b>"
}


