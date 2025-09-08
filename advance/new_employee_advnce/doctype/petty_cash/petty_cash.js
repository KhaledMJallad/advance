// Copyright (c) 2025, Khaled Jallad and contributors
// For license information, please see license.txt


let requested_petty_cash = 0;
let ended_petty_cash = 0;
let petty_cash_amount = 0;
let custom_on_behalf = null;
let requested_and_ended_petty_cash = {};
frappe.ui.form.on("Petty-cash", {
    on_submit:async function(frm){
        switch(frm.doc.petty_cash_type){
            case "Initial Petty cash Float":
                await create_advance_auto(frm, petty_cash_amount);
                frm.reload_doc();
            break;
            default:
                frappe.route_options ={
                    'project': frm.doc.project,
                    'custom_pettycash': frm.doc.name,
                    "custom_espense_type":frm.doc.petty_cash_type
                };
                frappe.new_doc('Expense Claim')
            break;
        }
    },
    before_save:function(frm){
        if(frm.doc.petty_cash_type === "Select One"){
            frappe.throw("Please select a petty-cash type before saving.")
        }
    },
	onload:async function(frm) {
        let liaison_officer = null;
        if(!frm.doc.project){
            frappe.throw("You are attempting to access it in an unauthorized manner. Please contact your system administrator to resolve this issue.");  
        }else{
            liaison_officer = await get_liaison_officer(frm);
            requested_and_ended_petty_cash = await fetch_requested_and_end_petty_cash(frm)
            if(frappe.user.has_role("System Manager")){
                frm.set_value('liaison_officer', liaison_officer);
				frm.set_value('on_behalf', custom_on_behalf);
            }else{
                let employee_number = null;
                employee_number = await get_employee_number(frm);
                if(employee_number === liaison_officer){
                    frm.set_value('liaison_officer',employee_number)
					frm.set_value('on_behalf', custom_on_behalf);
                }else{
                    frappe.throw("You do not have permission to access this page. Please contact your system administrator to resolve this issue.")
                }

            }
        }
	},
    petty_cash_type:function(frm){
        if(frm.doc.petty_cash_type === "Select One") return;
        let allowed_opt_on_requested = ["Replenishment", "Petty-cash Project End"];
        if(allowed_opt_on_requested.includes(frm.doc.petty_cash_type)){
            if(requested_and_ended_petty_cash.requested <= requested_and_ended_petty_cash.ended){
                frm.set_value('petty_cash_type', 'Select One')
                frappe.throw("You must submit a petty-cash request before performing a Renewal, End, or adding Food.")
            }
        }else{
            if(requested_and_ended_petty_cash.requested > requested_and_ended_petty_cash.ended){
                frm.set_value('petty_cash_type', 'Select One')
                frappe.throw("Please close all active petty-cash accounts before submitting a new request.")
            }
        }
    }
});


async function get_liaison_officer(frm){
    let liaison_officer = null;

    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.petty_cash.petty_cash.get_lision_officer",
        args:{project:frm.doc.project}
    });

    if(response.message.status === 404){
        frappe.throw(response.message.message);
    }else{
        response.message.data.map((item) => {
            liaison_officer = item.custom_liaison_officer;
            petty_cash_amount = item.custom_pettycash_amount;
			custom_on_behalf = item.custom_on_behalf;
        });

        return liaison_officer;
    }
}

async function get_employee_number(frm){
    let employee_number = null;
    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_employee_number",
        args:{user:frappe.session.user}
    });
    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }else{
        response.message.data.map((item) => {
            employee_number = item.name
        })

        return employee_number
    }
}


async function fetch_requested_and_end_petty_cash(frm){
    let requested_petty_cash = 0;
    let ended_petty_cash = 0;
    let requested_and_ended_petty_cash = {}
    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.petty_cash.petty_cash.fetch_requested_and_end_peety_cash",
        args:{project:frm.doc.project}
    })

    if(response.message.status === 200){
        response.message.petty_cash_request.map(item => requested_petty_cash = item.requested)
        response.message.petty_cash_end.map(item => ended_petty_cash = item.end)
        requested_and_ended_petty_cash = {'requested': requested_petty_cash, 'ended': ended_petty_cash}
        return requested_and_ended_petty_cash;
    }else{
        frappe.throw('An error has occurred. Please contact your administrator to resolve this issue.')
    }
}


async function create_advance_auto(frm, petty_cash){
    frappe.call({
        method:"advance.new_employee_advnce.doctype.petty_cash.petty_cash.create_new_advance",
        args:{name:frm.doc.name, petty_cash_amount:petty_cash, employee:frm.doc.liaison_officer, project:frm.doc.project, company:frm.doc.custom_company},
        freeze: true,
        freeze_message: __("Create Advance, Please waite..."),
        callback:function(resp){
            if(resp.message.status === 201){
                frappe.show_alert({
                message: __("File linked successfully"),
                indicator: "green"
            }, 5);
            frm.reload_doc();
            }else{
                frappe.throw('An error has occurred. Please contact your administrator to resolve this issue.')
            }
        }
    })
}
