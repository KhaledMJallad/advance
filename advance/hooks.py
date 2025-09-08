app_name = "advance"
app_title = "new Employee Advnce "
app_publisher = "Khaled Jallad"
app_description = "this is a new app for advance "
app_email = "Khaled.jalad@ivalueconsult.com"
app_license = "mit"

fixtures = [
      {
        "dt": "Workflow",
        "filters": [["name", "in", ["Petty-Cash Food", "Expense Food", "Advance Flow"]]]
    },
    {
        "dt": "Workflow State",
        "filters": [["workflow_state_name", "in", ["Initiator", "Project Manager", "Accountant", "CFO", "Supporting Services Director", "Approved", "Rejected", "Accountant Submit", "unpaid", "paid"]]]
    },
    {"dt": "DocType", "filters": [["name", "=", "Expense Claim Detail"]]}
]

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "advance",
# 		"logo": "/assets/advance/logo.png",
# 		"title": "new Employee Advnce ",
# 		"route": "/advance",
# 		"has_permission": "advance.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/advance/css/advance.css"
# app_include_js = "/assets/advance/js/advance.js"

# include js, css files in header of web template
# web_include_css = "/assets/advance/css/advance.css"
# web_include_js = "/assets/advance/js/advance.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "advance/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}	
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {

	"Employee Advance" : "public/js/employee_advance.js",
	"Expense Claim" : "public/js/expense_claim.js",
	"Project" :"public/js/Project.js",
	"Payment Entry":"public/js/payment_entry.js"

}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "advance/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "advance.utils.jinja_methods",
# 	"filters": "advance.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "advance.install.before_install"
# after_install = "advance.install.after_install"

# Uninstallation
# ------------

before_uninstall = "advance.uninstall.before_uninstall"
# after_uninstall = "advance.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "advance.utils.before_app_install"
# after_app_install = "advance.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "advance.utils.before_app_uninstall"
# after_app_uninstall = "advance.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "advance.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

#override_doctype_class = {"Employee Advance": "advance.overrides.employee_advance.employee_advance.CustomEmployeeAdvance"}

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"advance.tasks.all"
# 	],
# 	"daily": [
# 		"advance.tasks.daily"
# 	],
# 	"hourly": [
# 		"advance.tasks.hourly"
# 	],
# 	"weekly": [
# 		"advance.tasks.weekly"
# 	],
# 	"monthly": [
# 		"advance.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "advance.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "advance.event.get_events"
#}
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "advance.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["advance.utils.before_request"]
# after_request = ["advance.utils.after_request"]

# Job Events
# ----------
# before_job = ["advance.utils.before_job"]
# after_job = ["advance.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"advance.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }


#override_report = {
#   "General Ledger": "advance.advance.report.custom_general_ledger.custom_general_ledger"
#}




