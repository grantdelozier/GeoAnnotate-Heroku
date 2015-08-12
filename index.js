var express = require('express');
var app = express();
//var cool = require('cool-ascii-faces');
var bcrypt = require('bcrypt');
var http = require('http'), fs = require('fs');
var https = require('https');
var bodyParser = require('body-parser');
var session = require('cookie-session');
var mailer = require("nodemailer");
var path = require('path');

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
app.use(session({keys:['annotator'], maxAge:14400000}));
app.use(bodyParser());

var annotateDir = path.join(__dirname, 'annotate')





//app.use(express.static(__dirname + '/public'));

app.get('/db', function (request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
	client.query('SELECT * FROM test_table', function(err, result) {
	  done();
	  if (err)
	   { console.error(err); response.send("Error " + err); }
	  else
	   { response.send(result.rows); }
	});
	});
})

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
	console.log("Logging out ", req.session.usernmae);
	req.session = null;
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

app.get('/payer-annotate', function(request, response) {
	response.sendFile('./annotate/payer-annotate.html');
});

app.get('/create-user', function(request, response) {
	//response.redirect('./annotate/create-user.html');
	response.sendFile('./annotate/create-user.html');
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
		});
		

	});
	//Need to redirect to login page after this
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
						}else{
							smtpTransport.sendMail(mail, function(error, response){
							    if(error){
							        console.log(error);
							        response.send(error);
							    }else{
							        console.log("Message sent: " + response.message);
							        var hash = bcrypt.hashSync(req.body.password, salt);

							        http_response.send("Confirmation Email has been sent to " + req.body.user);
							    	
							    }

							    smtpTransport.close();
							});
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

app.get('/annotate/entity-annotate', function(req, response) {
	console.log(req.body);
	if (req.session.username && req.session.password != null) {
		console.log(req.session.username + " navigating to entity-annotate page")
		response.sendFile(path.join(annotateDir, 'payer-annotate.html'));
	}
	else{
		console.log("invalid credentials")
		response.send("<p>You are not logged in. You must log in before preceding.</p><p></p><p> Return to " + '<a href="' + appurl + '">' + "the login page" + "</a></p>" );
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
        pass: "GeoGrun21"
    }
});

var mail = {
    from: "GeoAnnotate App <GeoAnnotateApp@gmail.com>",
    to: "to@gmail.com",
    subject: "GeoAnnotate Account Verification",
    text: "Node.js New world for me",
    html: "<b>Node.js New world for me</b>"
}


