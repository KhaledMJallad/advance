let liaison_officer = null;

frappe.ui.form.on('Project', {
	onload:async function(frm) {
		await get_no_of_petty_cahs_request(frm)
		if(frappe.user.has_role("System Manager")){
			$(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Petty-cash"]').find('.button').show()
		}else{
			await get_employee_number(frm)
			if(liaison_officer === frm.doc.custom_liaison_officer){
				$(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Petty-cash"]').find('.button').show()
			}else{
				$(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Petty-cash"]').find('button').hide()
			}

		}



	}
})


async function get_employee_number(frm){
    const user = frappe.session.user;
    
    const response = await frappe.call({
        method:"advance.overrides.Project.Project.get_employee_id",
        args:{user:user}
    })
    if (response.message.status === 200){
        response.message.data.map(item => liaison_officer = item.name)
    }else{
        frappe.throw('User you logged in with is not exiets or not active. please contact your admin to solve the problem')
    }

}


async function get_no_of_petty_cahs_request(frm){
	let petty_cash_requested = 0;
    let petty_cash_end = 0
	const resonse = await frappe.call({
		method:"advance.new_employee_advnce.doctype.petty_cash.petty_cash.fetch_requested_and_end_peety_cash",
		args:{project:frm.doc.name}
	});

	if(resonse.message.status === 200){
        resonse.message.petty_cash_request.map((item) => {
            petty_cash_requested = item.requested
        })
         resonse.message.petty_cash_end.map((item) => {
            petty_cash_end = item.end
    	})
    }

	if(frappe.user.has_role('Projects Manager') || frappe.user.has_role('System Manager')){
		frm.set_df_property('custom_liaison_officer', 'read_only', false) 
		frm.set_df_property('custom_pettycash_amount', 'read_only', false)
		frm.set_df_property('custom_on_behalf', 'read_only', false)
	}
	if(petty_cash_requested > petty_cash_end){
            frm.set_df_property('custom_liaison_officer', 'read_only', true) 
		    frm.set_df_property('custom_pettycash_amount', 'read_only', true)
			frm.set_df_property('custom_on_behalf', 'read_only', true)
    }else if(petty_cash_requested  <= petty_cash_end){
		frm.set_df_property('custom_liaison_officer', 'read_only', false) 
		frm.set_df_property('custom_pettycash_amount', 'read_only', false)
		frm.set_df_property('custom_on_behalf', 'read_only', false)
	}
}
