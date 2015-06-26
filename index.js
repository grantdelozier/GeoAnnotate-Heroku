var express = require('express');
var app = express();
var cool = require('cool-ascii-faces');
var bcrypt = require('bcrypt');
var http = require('http'), fs = require('fs');
var https = require('https');
var bodyParser = require('body-parser');
var session = require('cookie-session');

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
app.use(express.static(__dirname + '/annotate'));
app.use(session({keys:['annotator'], maxAge:7200000}));
app.use(bodyParser());





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
  response.send(cool());
});

app.get('/payer-annotate', function(request, response) {
	response.sendfile('./annotate/payer-annotate.html');
});

app.post('/annotate/user-login', function(req, response) {
	//console.log(req.body)
	//console.log(req.session)
	if (req.session.username && req.session.password != null) {
		console.log("Already logged in.")
		//response.redirect('/payer-annotate');
	}
	else{
		pg.connect(process.env.DATABASE_URL, function(err, client, done) {
			var hash = bcrypt.hashSync(req.body.password, salt);
			client.query("SELECT * from user_passwords WHERE user_passwords.usr = $1 and user_passwords.pass = $2;", [req.body.user, hash], function(err, result){
				if (err) { 
					console.error(err); }
				else if (result.rows.length > 0) {
					console.log(result);
					req.session.username = req.body.user;
					req.session.password = hash;
					//response.redirect('/payer-annotate')
				}
			})
		});
		//check_pass = "SELECT * from user_passwords WHERE user_passwords.usr = $1;", [req.session.user]
	}
	/*if (req.body.user && req.body.password){

	}*/
	//console.log(req.body.username)
	//console.log(req.body.password)
	return;
});

/*app.get('/payer-annotate', function(request, response) {
	fs.readFile('./annotate/payer-annotate.hmtl', function(err, html) {
		if (err){
			throw err;
		}
		http.createServer(function(request, response) {
			response.writeHead(200, {"Content-Type": "text/html"});
			response.write(html);
			response.end();
		}).listen(8000);
	})
});*/

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
