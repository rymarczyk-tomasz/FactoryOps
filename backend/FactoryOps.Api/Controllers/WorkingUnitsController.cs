using FactoryOps.Domain.Ports;
using Microsoft.AspNetCore.Mvc;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("units")]
public class WorkingUnitsController : ControllerBase
{
	private readonly IWorkingUnitsRepository workingUnitsRepository;
	public WorkingUnitsController(IWorkingUnitsRepository workingUnitsRepository)
	{
		this.workingUnitsRepository = workingUnitsRepository;
	}

	

}
